import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type * as MapLibre from 'maplibre-gl';
import {
  CurrencyFormatPipe,
  DateFormatPipe,
  LoaderComponent,
  Trip,
  TRIP_STATUS_COLORS,
  TripService,
} from 'voyage-lib';
import { TripManagementService } from '@core/services/trip-management.service';
import { TRIP_STATUS_OPTIONS } from '@shared/constants/trip.constant';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS_PX,
  ENGLISH_PLACE_NAME,
  MAP_STYLES,
  MAPLIBRE_STYLESHEET,
  MAPLIBRE_WORKER,
  MAX_LOCATE_CALLS,
  STATUS_BY_PRIORITY,
  STATUS_PRIORITY,
  TRIPS_SOURCE,
  WORLD_VIEW,
} from '../../constants/my-journey.constant';
import { computeJourneyStats } from './journey-stats';
import { groupByPlace, isLocated, PlaceGroup } from './trip-groups';

@Component({
  selector: 'app-my-journey',
  imports: [LoaderComponent, CurrencyFormatPipe],
  templateUrl: './my-journey.html',
  styleUrl: './my-journey.css',
  // MapLibre creates its own DOM (markers, popups, controls), which Angular's emulated
  // encapsulation can't reach. Styles are scoped by the app-my-journey selector instead.
  encapsulation: ViewEncapsulation.None,
})
export class MyJourney {
  private readonly tripService = inject(TripService);
  private readonly tripManagementService = inject(TripManagementService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('map');

  private readonly currencyFormat = new CurrencyFormatPipe();
  private readonly dateFormat = new DateFormatPipe();

  private maplibre?: typeof MapLibre;
  private map?: MapLibre.Map;
  /** One marker per place group (same index as placeGroups()); shown only when not clustered. */
  private placeMarkers: MapLibre.Marker[] = [];
  /** Cluster bubbles, created as clusters appear, by cluster id. */
  private clusterMarkers = new Map<number, MapLibre.Marker>();
  /** Markers currently on the map: place pins and cluster bubbles. */
  private shownMarkers = new Set<MapLibre.Marker>();
  private hasFramedTrips = false;

  protected readonly statusOptions = TRIP_STATUS_OPTIONS;
  protected readonly statusColors = TRIP_STATUS_COLORS;

  protected readonly trips = signal<Trip[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLocating = signal(false);
  protected readonly loadFailed = signal(false);
  /** True when the browser can't draw the map (no WebGL); the trip list still works. */
  protected readonly mapUnavailable = signal(false);

  private readonly locatedTrips = computed(() => this.trips().filter(isLocated));
  /** One entry per pin: trips at the same place share a pin. */
  private readonly placeGroups = computed(() => groupByPlace(this.locatedTrips()));
  protected readonly unlocatedTrips = computed(() => this.trips().filter((trip) => !isLocated(trip)));
  protected readonly stats = computed(() => computeJourneyStats(this.trips()));
  /** Trips per status, for the header line that doubles as the map legend. */
  protected readonly tripsByStatus = computed(() => {
    const counts: Record<Trip['status'], number> = { planning: 0, ongoing: 0, completed: 0 };
    for (const trip of this.trips()) counts[trip.status]++;
    return counts;
  });

  constructor() {
    // Browser-only: MapLibre needs WebGL, window and document.
    afterNextRender(() => {
      void this.initMap().then(() => this.loadTrips());
    });

    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  protected async loadTrips(): Promise<void> {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    try {
      this.showTrips(await firstValueFrom(this.tripService.getAllTrips()));
    } catch {
      this.loadFailed.set(true);
      return;
    } finally {
      this.isLoading.set(false);
    }

    await this.locateMissingTrips();
  }

  /**
   * Trips created before the map existed have no coordinates yet. The backend
   * geocodes a few per call (Nominatim allows 1 lookup per second), so keep
   * calling while it reports progress.
   */
  private async locateMissingTrips(): Promise<void> {
    if (this.unlocatedTrips().length === 0) return;

    this.isLocating.set(true);
    try {
      let previousRemaining = Infinity;
      for (let call = 0; call < MAX_LOCATE_CALLS; call++) {
        const { trips, remaining } = await firstValueFrom(this.tripManagementService.locateTrips());
        this.showTrips(trips);
        // Stop when done, or when a call made no progress (e.g. the geocoder is down).
        if (remaining === 0 || remaining >= previousRemaining) break;
        previousRemaining = remaining;
      }
    } catch (error) {
      console.error('Could not locate trips', error);
    } finally {
      this.isLocating.set(false);
    }
  }

  private async initMap(): Promise<void> {
    const [maplibre] = await Promise.all([import('maplibre-gl'), this.ensureMapStyles()]);
    this.maplibre = maplibre;

    // MapLibre finds its worker relative to its own file, which no longer exists
    // once the bundler has merged it into a chunk, so point it at the copied file.
    // The version query keeps a cached worker from an older MapLibre from being used.
    maplibre.setWorkerUrl(
      new URL(`${MAPLIBRE_WORKER}?v=${maplibre.getVersion()}`, this.document.baseURI).href,
    );

    try {
      this.map = new maplibre.Map({
        container: this.mapElement().nativeElement,
        style: MAP_STYLES[this.isDarkTheme() ? 'dark' : 'light'],
        center: WORLD_VIEW.center,
        zoom: WORLD_VIEW.zoom,
        attributionControl: { compact: true },
      });
    } catch (error) {
      console.error('Map could not be created (WebGL unavailable?)', error);
      this.mapUnavailable.set(true);
      return;
    }

    this.map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-left');

    // OpenFreeMap's dark style refers to an icon its sprite doesn't contain ("circle-11").
    // Register an invisible placeholder instead of logging a warning for every tile.
    const map = this.map;
    map.setMissingStyleImageResolver((id) => {
      if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    // Runs after every style load, including theme switches (setStyle replaces the style).
    this.map.on('style.load', () => {
      this.map?.setProjection({ type: 'globe' });
      this.useEnglishPlaceNames();
      this.addTripsSource();
    });

    // Cheap with a few dozen trips; this is how MapLibre's HTML-cluster example keeps markers in sync.
    this.map.on('render', () => this.syncMarkers());

    this.watchTheme();

    // MapLibre follows window resizes itself; also follow the container (sidebar opening/closing).
    const resizeObserver = new ResizeObserver(() => this.map?.resize());
    resizeObserver.observe(this.mapElement().nativeElement);
    this.destroyRef.onDestroy(() => resizeObserver.disconnect());
  }

  /** Adds MapLibre's stylesheet the first time the map opens; later visits reuse it. */
  private ensureMapStyles(): Promise<void> {
    const id = 'maplibre-styles';
    if (this.document.getElementById(id)) return Promise.resolve();

    return new Promise((resolve) => {
      const link = this.document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = MAPLIBRE_STYLESHEET;
      // Resolve on error too: a map with unstyled controls is better than no map.
      link.onload = link.onerror = () => resolve();
      this.document.head.appendChild(link);
    });
  }

  private isDarkTheme(): boolean {
    return this.document.documentElement.classList.contains('dark');
  }

  /** Switches between the light and dark map styles when the app theme changes. */
  private watchTheme(): void {
    let dark = this.isDarkTheme();
    const observer = new MutationObserver(() => {
      if (this.isDarkTheme() === dark) return;
      dark = !dark;
      // Markers and popups are DOM elements on top of the map, so they survive the style swap.
      this.map?.setStyle(MAP_STYLES[dark ? 'dark' : 'light']);
    });
    observer.observe(this.document.documentElement, { attributes: true, attributeFilter: ['class'] });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** The styles label places in Latin + local script ("Moskva Москва"); prefer English instead. */
  private useEnglishPlaceNames(): void {
    const map = this.map;
    if (!map) return;
    for (const layer of map.getStyle().layers) {
      if (layer.type !== 'symbol') continue;
      const textField = map.getLayoutProperty(layer.id, 'text-field');
      // Only name labels; road shields etc. use other properties such as "ref".
      if (textField && JSON.stringify(textField).includes('"name')) {
        map.setLayoutProperty(layer.id, 'text-field', ENGLISH_PLACE_NAME);
      }
    }
  }

  /**
   * The style holds the trip positions as a clustered GeoJSON source. setStyle() (theme
   * switch) drops it, so this runs after every style load. The pins themselves stay HTML
   * markers, placed by syncMarkers().
   */
  private addTripsSource(): void {
    const map = this.map;
    if (!map || map.getSource(TRIPS_SOURCE)) return;

    map.addSource(TRIPS_SOURCE, {
      type: 'geojson',
      data: this.tripsGeoJson(),
      cluster: true,
      clusterRadius: CLUSTER_RADIUS_PX,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      // Totals for each cluster: its trips, and its most active status (lowest priority).
      clusterProperties: {
        tripCount: ['+', ['get', 'tripCount']],
        priority: ['min', ['get', 'priority']],
      },
    });
    // Invisible: it only makes MapLibre load the source, so querySourceFeatures() has data.
    map.addLayer({
      id: TRIPS_SOURCE,
      type: 'circle',
      source: TRIPS_SOURCE,
      paint: { 'circle-radius': 0, 'circle-opacity': 0 },
    });
    this.clearClusterMarkers();
  }

  /** One point per place group; groupIndex links it back to its marker. */
  private tripsGeoJson() {
    return {
      type: 'FeatureCollection' as const,
      features: this.placeGroups().map((group, groupIndex) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [group.longitude, group.latitude] },
        properties: {
          groupIndex,
          tripCount: group.trips.length,
          priority: STATUS_PRIORITY[group.trips[0].status],
        },
      })),
    };
  }

  /**
   * Shows a place pin for every place that stands alone at this zoom and a bubble for
   * every cluster, and removes the rest. Runs on every render (move, zoom, data change).
   */
  private syncMarkers(): void {
    const map = this.map;
    if (!map?.getSource(TRIPS_SOURCE) || !map.isSourceLoaded(TRIPS_SOURCE)) return;

    const wanted = new Set<MapLibre.Marker>();
    // Features come per tile, so a point near a tile edge can appear twice; the Set dedupes.
    for (const feature of map.querySourceFeatures(TRIPS_SOURCE)) {
      const properties = feature.properties;
      if (properties['cluster'] && feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        wanted.add(this.clusterMarker(properties['cluster_id'], [lng, lat], properties));
      } else {
        const marker = this.placeMarkers[properties['groupIndex']];
        if (marker) wanted.add(marker);
      }
    }

    for (const marker of this.shownMarkers) if (!wanted.has(marker)) marker.remove();
    for (const marker of wanted) if (!this.shownMarkers.has(marker)) marker.addTo(map);
    this.shownMarkers = wanted;
  }

  /** Cluster ids are only valid for the data they came from: drop the bubbles when it changes. */
  private clearClusterMarkers(): void {
    for (const marker of this.clusterMarkers.values()) {
      marker.remove();
      this.shownMarkers.delete(marker);
    }
    this.clusterMarkers.clear();
  }

  private showTrips(trips: Trip[]): void {
    this.trips.set(trips);
    const maplibre = this.maplibre;
    const map = this.map;
    if (!maplibre || !map) return;

    this.placeMarkers.forEach((marker) => marker.remove());
    this.shownMarkers.clear();
    this.clearClusterMarkers();
    const groups = this.placeGroups();
    // Not added to the map here: syncMarkers() adds the ones that aren't inside a cluster.
    this.placeMarkers = groups.map((group) =>
      new maplibre.Marker({ element: this.markerElement(group), anchor: 'bottom', offset: [0, -6] })
        .setLngLat([group.longitude, group.latitude])
        .setPopup(
          new maplibre.Popup({ offset: 36, maxWidth: '280px' }).setDOMContent(this.popupContent(group)),
        ),
    );
    map.getSource<MapLibre.GeoJSONSource>(TRIPS_SOURCE)?.setData(this.tripsGeoJson());

    // Jump on the first render; animate when later updates (newly located trips) move the view.
    const animate = this.hasFramedTrips;
    this.hasFramedTrips = groups.length > 0;

    if (groups.length === 0) {
      map.jumpTo({ center: WORLD_VIEW.center, zoom: WORLD_VIEW.zoom });
    } else if (groups.length === 1) {
      const center: [number, number] = [groups[0].longitude, groups[0].latitude];
      if (animate) map.flyTo({ center, zoom: 5 });
      else map.jumpTo({ center, zoom: 5 });
    } else {
      const bounds = new maplibre.LngLatBounds();
      groups.forEach((group) => bounds.extend([group.longitude, group.latitude]));
      map.fitBounds(bounds, { padding: 70, maxZoom: 6, animate });
    }
  }

  /**
   * Pin plus place-name label (with a trip count when several trips share the place),
   * as one element so they move together. Built with textContent, never innerHTML,
   * because trip names and destinations are user input.
   */
  private markerElement(group: PlaceGroup): HTMLElement {
    const lead = group.trips[0];
    const count = group.trips.length;

    const marker = this.document.createElement('div');
    marker.className = 'journey-marker';
    marker.setAttribute('role', 'button');
    marker.setAttribute(
      'aria-label',
      count === 1 ? `${lead.name}, ${lead.destination}` : `${lead.destination}: ${count} trips`,
    );
    marker.title = group.trips.map((trip) => trip.name).join(', ');

    const pin = this.document.createElement('span');
    pin.className = 'journey-pin';
    pin.style.setProperty('--pin-color', this.statusColors[lead.status].color);

    const label = this.document.createElement('span');
    label.className = 'journey-label';
    label.textContent = lead.destination;
    if (count > 1) {
      const badge = this.document.createElement('span');
      badge.className = 'journey-label-count';
      badge.textContent = `×${count}`;
      label.appendChild(badge);
    }

    marker.append(pin, label);
    return marker;
  }

  /**
   * A bubble for nearby places merged at this zoom: trip count inside, coloured by the most
   * active trip, labelled with the main place ("Goa & 2 more"). Clicking zooms in until
   * the cluster splits apart.
   */
  private clusterMarker(
    clusterId: number,
    lngLat: [number, number],
    properties: Record<string, number>,
  ): MapLibre.Marker {
    const existing = this.clusterMarkers.get(clusterId);
    if (existing) return existing;

    const placeCount = properties['point_count'];
    const tripCount = properties['tripCount'];
    const status = STATUS_BY_PRIORITY[properties['priority']] ?? 'completed';

    const element = this.document.createElement('div');
    element.className = 'journey-cluster';
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', `${placeCount} places, ${tripCount} trips. Zoom in`);
    element.title = 'Zoom in';

    const bubble = this.document.createElement('span');
    bubble.className = 'journey-cluster-bubble';
    bubble.style.setProperty('--pin-color', this.statusColors[status].color);
    bubble.textContent = String(tripCount);

    const label = this.document.createElement('span');
    label.className = 'journey-label';
    label.textContent = `${placeCount} places`;
    element.append(bubble, label);

    const source = this.map?.getSource<MapLibre.GeoJSONSource>(TRIPS_SOURCE);
    // Name the cluster after its most active place (ties: the most trips), and list all of them on hover.
    void source?.getClusterLeaves(clusterId, Infinity, 0).then((leaves) => {
      const groups = leaves
        .map((leaf) => this.placeGroups()[leaf.properties?.['groupIndex']])
        .filter((group): group is PlaceGroup => !!group)
        .sort(
          (a, b) =>
            STATUS_PRIORITY[a.trips[0].status] - STATUS_PRIORITY[b.trips[0].status] ||
            b.trips.length - a.trips.length,
        );
      if (groups.length === 0) return;
      label.textContent = `${groups[0].trips[0].destination} & ${groups.length - 1} more`;
      element.title = `${groups.map((group) => group.trips[0].destination).join(', ')}. Click to zoom in`;
    });

    element.addEventListener('click', () => {
      void source?.getClusterExpansionZoom(clusterId).then((zoom) => {
        this.map?.easeTo({ center: lngLat, zoom });
      });
    });

    const marker = new this.maplibre!.Marker({ element, anchor: 'center' }).setLngLat(lngLat);
    this.clusterMarkers.set(clusterId, marker);
    return marker;
  }

  /** One trip: its details. Several trips at one place: a header and a scrollable list. */
  private popupContent(group: PlaceGroup): HTMLElement {
    const root = this.document.createElement('div');
    root.className = 'journey-popup';

    if (group.trips.length === 1) {
      this.appendTripDetails(root, group.trips[0], true);
      return root;
    }

    const lead = group.trips[0];
    const header = this.document.createElement('p');
    header.className = 'journey-popup-place';
    header.textContent = `${[lead.destination, lead.country].filter(Boolean).join(', ')} · ${group.trips.length} trips`;
    root.appendChild(header);

    const list = this.document.createElement('div');
    list.className = 'journey-popup-list';
    for (const trip of group.trips) {
      const item = this.document.createElement('div');
      item.className = 'journey-popup-item';
      this.appendTripDetails(item, trip, false);
      list.appendChild(item);
    }
    root.appendChild(list);
    return root;
  }

  /** Status, name, dates, spending and a link for one trip. Text only (user input). */
  private appendTripDetails(container: HTMLElement, trip: Trip, showPlace: boolean): void {
    const line = (className: string, text: string) => {
      const element = this.document.createElement('p');
      element.className = className;
      element.textContent = text;
      container.appendChild(element);
      return element;
    };

    const status = this.statusOptions.find((option) => option.value === trip.status)?.label ?? trip.status;
    const badge = line('journey-popup-status', status);
    badge.style.color = this.statusColors[trip.status].color;
    badge.style.background = this.statusColors[trip.status].background;

    line('journey-popup-title', trip.name);
    if (showPlace) {
      line('journey-popup-meta', [trip.destination, trip.country].filter(Boolean).join(', '));
    }
    line(
      'journey-popup-meta',
      `${this.dateFormat.transform(trip.startDate)} – ${this.dateFormat.transform(trip.endDate)}`,
    );
    line(
      'journey-popup-meta',
      `${this.currencyFormat.transform(trip.spent, trip.currency)} of ${this.currencyFormat.transform(trip.budget, trip.currency)} spent`,
    );

    const button = this.document.createElement('button');
    button.type = 'button';
    button.className = 'journey-popup-link';
    button.textContent = 'View expenses →';
    button.addEventListener('click', () => this.router.navigate(['/expenses', trip.id]));
    container.appendChild(button);
  }
}
