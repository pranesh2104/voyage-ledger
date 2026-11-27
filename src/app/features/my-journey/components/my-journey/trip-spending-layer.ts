import type * as MapLibre from 'maplibre-gl';
import { CATEGORY_COLORS, CATEGORY_ICONS } from 'voyage-lib';
import {
  PATH_ARROW_IMAGE,
  PATH_COLORS,
  PATH_LAYERS,
  PATH_SOURCE,
  SPENDING_SOURCE,
  SPOT_CLUSTER_MAX_ZOOM,
  SPOT_CLUSTER_RADIUS_PX,
  SPOT_SIZE_PX,
  TRIP_VIEW_MAX_ZOOM,
} from '../../constants/my-journey.constant';
import { SpendingSpot } from '../../models/my-journey.model';

export interface SpendingFormatters {
  /** An amount in the trip's currency: "₹1,200". */
  amount: (amount: number) => string;
  date: (date: Date) => string;
}

/** Close enough that a spot's pin is no longer inside a cluster bubble (clusters stop above SPOT_CLUSTER_MAX_ZOOM). */
const FOCUS_ZOOM = SPOT_CLUSTER_MAX_ZOOM + 0.5;

/**
 * Draws one trip's spending on the map: a pin for each place money was spent (sized by the
 * amount, numbered by first visit, merged into bubbles when they crowd) and the journey path
 * between them. Pins are HTML markers synced from a clustered GeoJSON source, the same way as the
 * trip pins; the path is a line layer that fades from the start colour to the end colour.
 * Pins and popups are built with textContent, never innerHTML: descriptions and place names are user input.
 */
export class TripSpendingLayer {
  private spots: SpendingSpot[] = [];
  private path: [number, number][] = [];
  /** One per spot, same index as spots; shown only when not inside a cluster. */
  private spotMarkers: MapLibre.Marker[] = [];
  private clusterMarkers = new Map<number, MapLibre.Marker>();
  private shownMarkers = new Set<MapLibre.Marker>();
  private pathVisible = true;
  private highlighted: HTMLElement | null = null;

  constructor(
    private readonly map: MapLibre.Map,
    private readonly maplibre: typeof MapLibre,
    private readonly document: Document,
    private readonly format: SpendingFormatters,
  ) {}

  /** Replaces whatever is drawn with these spots and path. */
  show(spots: SpendingSpot[], path: [number, number][]): void {
    this.clear();
    this.spots = spots;
    this.path = path;
    const maxTotal = Math.max(0, ...spots.map((spot) => spot.total));
    // Not added to the map here: syncMarkers() adds the ones that aren't inside a cluster.
    this.spotMarkers = spots.map((spot) =>
      new this.maplibre.Marker({ element: this.spotElement(spot, maxTotal), anchor: 'center' })
        .setLngLat([spot.longitude, spot.latitude])
        .setPopup(new this.maplibre.Popup({ offset: 24, maxWidth: '300px' }).setDOMContent(this.popupContent(spot))),
    );
    this.addToStyle();
  }

  /**
   * Adds the sources and layers to the current style. setStyle() (theme switch) drops them, so
   * this also runs after every style load.
   */
  addToStyle(): void {
    const map = this.map;
    if (this.spots.length === 0) return;

    // Under the first label layer, so place names stay readable on top of the path.
    const beforeId = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;

    if (this.path.length >= 2 && !map.getSource(PATH_SOURCE)) {
      if (!map.hasImage(PATH_ARROW_IMAGE)) map.addImage(PATH_ARROW_IMAGE, this.arrowImage(), { pixelRatio: 2 });
      map.addSource(PATH_SOURCE, {
        type: 'geojson',
        lineMetrics: true, // needed for line-gradient
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: this.path } },
      });
      const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
      map.addLayer(
        { id: PATH_LAYERS.casing, type: 'line', source: PATH_SOURCE, layout, paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 } },
        beforeId,
      );
      map.addLayer(
        {
          id: PATH_LAYERS.line,
          type: 'line',
          source: PATH_SOURCE,
          layout,
          paint: {
            'line-width': 4,
            'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, PATH_COLORS.start, 1, PATH_COLORS.end],
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: PATH_LAYERS.arrows,
          type: 'symbol',
          source: PATH_SOURCE,
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 90,
            'icon-image': PATH_ARROW_IMAGE,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-rotation-alignment': 'map',
          },
        },
        beforeId,
      );
    }

    if (!map.getSource(SPENDING_SOURCE)) {
      map.addSource(SPENDING_SOURCE, {
        type: 'geojson',
        data: this.spotsGeoJson(),
        cluster: true,
        clusterRadius: SPOT_CLUSTER_RADIUS_PX,
        clusterMaxZoom: SPOT_CLUSTER_MAX_ZOOM,
        clusterProperties: {
          total: ['+', ['get', 'total']],
          expenseCount: ['+', ['get', 'expenseCount']],
        },
      });
      // Invisible: it only makes MapLibre load the source, so querySourceFeatures() has data.
      map.addLayer({ id: SPENDING_SOURCE, type: 'circle', source: SPENDING_SOURCE, paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
    }

    this.setPathVisible(this.pathVisible);
    this.clearClusterMarkers();
  }

  /** Removes the pins, the path and their sources. */
  clear(): void {
    for (const marker of this.spotMarkers) marker.remove();
    this.clearClusterMarkers();
    this.spotMarkers = [];
    this.shownMarkers.clear();
    this.highlighted = null;
    for (const id of [SPENDING_SOURCE, PATH_LAYERS.arrows, PATH_LAYERS.line, PATH_LAYERS.casing]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    for (const id of [SPENDING_SOURCE, PATH_SOURCE]) {
      if (this.map.getSource(id)) this.map.removeSource(id);
    }
    this.spots = [];
    this.path = [];
  }

  /** Shows a pin for every spot that stands alone at this zoom and a bubble for every cluster. Runs on every render. */
  syncMarkers(): void {
    const map = this.map;
    if (this.spots.length === 0 || !map.getSource(SPENDING_SOURCE) || !map.isSourceLoaded(SPENDING_SOURCE)) return;

    const wanted = new Set<MapLibre.Marker>();
    for (const feature of map.querySourceFeatures(SPENDING_SOURCE)) {
      const properties = feature.properties;
      if (properties['cluster'] && feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        wanted.add(this.clusterMarker(properties['cluster_id'], [lng, lat], properties));
      } else {
        const marker = this.spotMarkers[properties['spotIndex']];
        if (marker) wanted.add(marker);
      }
    }

    for (const marker of this.shownMarkers) if (!wanted.has(marker)) marker.remove();
    for (const marker of wanted) if (!this.shownMarkers.has(marker)) marker.addTo(map);
    this.shownMarkers = wanted;
  }

  setPathVisible(visible: boolean): void {
    this.pathVisible = visible;
    for (const id of Object.values(PATH_LAYERS)) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }

  /** Enlarges one spot's pin (hovering its expense in the list); null for none. */
  highlight(order: number | null): void {
    this.highlighted?.classList.remove('is-highlighted');
    this.highlighted = order === null ? null : (this.spotMarkers[order - 1]?.getElement() ?? null);
    this.highlighted?.classList.add('is-highlighted');
  }

  /** Flies to a spot and opens its popup. */
  focusSpot(order: number): void {
    const spot = this.spots[order - 1];
    const marker = this.spotMarkers[order - 1];
    if (!spot || !marker) return;
    for (const other of this.spotMarkers) if (other !== marker && other.getPopup()?.isOpen()) other.togglePopup();
    this.map.flyTo({ center: [spot.longitude, spot.latitude], zoom: Math.max(this.map.getZoom(), FOCUS_ZOOM) });
    // The pin may be inside a cluster until the zoom ends; by then syncMarkers() has added it.
    this.map.once('moveend', () => {
      if (!marker.getPopup()?.isOpen()) marker.togglePopup();
    });
  }

  /** Frames the given spots (all of them by default). */
  fit(spots: SpendingSpot[] = this.spots, animate = true): void {
    if (spots.length === 0) return;
    if (spots.length === 1) {
      const camera = { center: [spots[0].longitude, spots[0].latitude] as [number, number], zoom: TRIP_VIEW_MAX_ZOOM };
      if (animate) this.map.flyTo(camera);
      else this.map.jumpTo(camera);
      return;
    }
    const bounds = new this.maplibre.LngLatBounds();
    for (const spot of spots) bounds.extend([spot.longitude, spot.latitude]);
    this.map.fitBounds(bounds, { padding: 70, maxZoom: TRIP_VIEW_MAX_ZOOM, animate });
  }

  private clearClusterMarkers(): void {
    for (const marker of this.clusterMarkers.values()) {
      marker.remove();
      this.shownMarkers.delete(marker);
    }
    this.clusterMarkers.clear();
  }

  /** One point per spot; spotIndex links it back to its marker. */
  private spotsGeoJson() {
    return {
      type: 'FeatureCollection' as const,
      features: this.spots.map((spot, spotIndex) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [spot.longitude, spot.latitude] },
        properties: { spotIndex, total: spot.total, expenseCount: spot.expenses.length },
      })),
    };
  }

  /**
   * A round pin with the category's icon, sized by the amount (square root, so area tracks the
   * amount), the visit number in a corner, and the amount to its right.
   */
  private spotElement(spot: SpendingSpot, maxTotal: number): HTMLElement {
    const ratio = maxTotal > 0 ? Math.sqrt(spot.total / maxTotal) : 0;
    const size = Math.round(SPOT_SIZE_PX.min + (SPOT_SIZE_PX.max - SPOT_SIZE_PX.min) * ratio);
    const place = spot.placeName ?? 'Pinned location';
    const count = spot.expenses.length;

    const marker = this.document.createElement('div');
    marker.className = 'spend-marker';
    marker.style.setProperty('--spot-size', `${size}px`);
    marker.setAttribute('role', 'button');
    marker.setAttribute(
      'aria-label',
      `${spot.order}. ${place}: ${this.format.amount(spot.total)}, ${count} ${count === 1 ? 'expense' : 'expenses'}`,
    );
    marker.title = place;

    const pin = this.document.createElement('span');
    pin.className = 'spend-pin';
    pin.style.setProperty('--spot-color', CATEGORY_COLORS[spot.category]);
    pin.textContent = CATEGORY_ICONS[spot.category];

    const order = this.document.createElement('span');
    order.className = 'spend-order';
    order.textContent = String(spot.order);
    pin.appendChild(order);

    const label = this.document.createElement('span');
    label.className = 'journey-label spend-label';
    label.textContent = this.format.amount(spot.total);
    if (count > 1) {
      const badge = this.document.createElement('span');
      badge.className = 'journey-label-count';
      badge.textContent = `×${count}`;
      label.appendChild(badge);
    }

    marker.append(pin, label);
    return marker;
  }

  /** Bubble for spots merged at this zoom: how many places, and what was spent there. Clicking zooms in. */
  private clusterMarker(clusterId: number, lngLat: [number, number], properties: Record<string, number>): MapLibre.Marker {
    const existing = this.clusterMarkers.get(clusterId);
    if (existing) return existing;

    const placeCount = properties['point_count'];
    const total = this.format.amount(properties['total']);

    const element = this.document.createElement('div');
    element.className = 'journey-cluster';
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', `${placeCount} places, ${total}. Zoom in`);
    element.title = 'Zoom in';

    const bubble = this.document.createElement('span');
    bubble.className = 'journey-cluster-bubble';
    bubble.style.setProperty('--pin-color', PATH_COLORS.end);
    bubble.textContent = String(placeCount);

    const label = this.document.createElement('span');
    label.className = 'journey-label';
    label.textContent = total;
    element.append(bubble, label);

    const source = this.map.getSource<MapLibre.GeoJSONSource>(SPENDING_SOURCE);
    element.addEventListener('click', () => {
      void source?.getClusterExpansionZoom(clusterId).then((zoom) => this.map.easeTo({ center: lngLat, zoom }));
    });

    const marker = new this.maplibre.Marker({ element, anchor: 'center' }).setLngLat(lngLat);
    this.clusterMarkers.set(clusterId, marker);
    return marker;
  }

  /** The place, then each expense there: what, how much, when and who paid. */
  private popupContent(spot: SpendingSpot): HTMLElement {
    const root = this.document.createElement('div');
    root.className = 'journey-popup';

    const header = this.document.createElement('p');
    header.className = 'journey-popup-place';
    const count = spot.expenses.length;
    header.textContent =
      `${spot.order}. ${spot.placeName ?? 'Pinned location'}` + (count > 1 ? ` · ${this.format.amount(spot.total)}` : '');
    root.appendChild(header);

    const list = this.document.createElement('div');
    list.className = 'journey-popup-list';
    for (const expense of spot.expenses) {
      const item = this.document.createElement('div');
      item.className = 'journey-popup-item spend-popup-item';

      const row = this.document.createElement('p');
      row.className = 'spend-popup-row';
      const icon = this.document.createElement('span');
      icon.textContent = CATEGORY_ICONS[expense.category];
      icon.setAttribute('aria-hidden', 'true');
      const title = this.document.createElement('span');
      title.className = 'spend-popup-title';
      title.textContent = expense.description;
      const amount = this.document.createElement('span');
      amount.className = 'spend-popup-amount';
      amount.textContent = this.format.amount(expense.amount);
      row.append(icon, title, amount);

      const meta = this.document.createElement('p');
      meta.className = 'journey-popup-meta';
      const payer = expense.paidByYou ? 'Paid by you' : expense.paidByName ? `Paid by ${expense.paidByName}` : '';
      meta.textContent = [this.format.date(expense.date), payer].filter(Boolean).join(' · ');

      item.append(row, meta);
      list.appendChild(item);
    }
    root.appendChild(list);
    return root;
  }

  /** A white chevron with a soft dark edge (readable on both themes), drawn at 2x for sharp screens. */
  private arrowImage(): ImageData {
    const size = 28;
    const canvas = this.document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d')!;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const chevron = () => {
      context.beginPath();
      context.moveTo(10, 7);
      context.lineTo(18, 14);
      context.lineTo(10, 21);
      context.stroke();
    };
    context.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    context.lineWidth = 7;
    chevron();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 3.5;
    chevron();
    return context.getImageData(0, 0, size, size);
  }
}
