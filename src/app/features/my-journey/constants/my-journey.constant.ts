import type { ExpressionSpecification } from 'maplibre-gl';
import { Trip } from 'voyage-lib';

// ---- Map ----

/** Free vector map styles from OpenFreeMap (no API key), one per app theme. */
export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
/** Built from node_modules/maplibre-gl by angular.json ("inject": false), so it isn't in the global CSS. */
export const MAPLIBRE_STYLESHEET = 'maplibre-gl.css';
/** Copied from node_modules/maplibre-gl/dist by angular.json "assets". */
export const MAPLIBRE_WORKER = 'maplibre/maplibre-gl-worker.mjs';
/** MapLibre takes [longitude, latitude], the reverse of how coordinates are usually written. */
export const WORLD_VIEW = { center: [20, 20] as [number, number], zoom: 1.2 };
/** Label text for map places: English name when the map data has one. */
export const ENGLISH_PLACE_NAME: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name:latin'],
  ['get', 'name'],
];
/** GeoJSON source (and its invisible layer) that clusters the trip pins. */
export const TRIPS_SOURCE = 'journey-trips';
/**
 * Pins closer than this on screen merge into one cluster bubble. Generous, because
 * each pin's label runs to its right and would otherwise overlap its neighbour's.
 */
export const CLUSTER_RADIUS_PX = 70;
/** From this zoom in, every place gets its own pin (same-place trips are already one pin). */
export const CLUSTER_MAX_ZOOM = 14;
/** Safety stop for the "locate missing trips" loop (each call handles a few trips). */
export const MAX_LOCATE_CALLS = 10;

// ---- Trip grouping ----

/** Trips this close together count as the same place and share one pin. */
export const SAME_PLACE_METERS = 100;

/** A shared pin (or cluster bubble) takes the colour of its most "active" trip: lowest number wins. */
export const STATUS_PRIORITY: Record<Trip['status'], number> = { ongoing: 0, planning: 1, completed: 2 };
/** STATUS_PRIORITY reversed: the status for a priority number. */
export const STATUS_BY_PRIORITY: Trip['status'][] = ['ongoing', 'planning', 'completed'];

// ---- Stats ----

/** Milliseconds in a day, for counting trip days. */
export const DAY_MS = 86_400_000;
