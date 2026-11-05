/** sessionStorage key of the demo data. Its presence is what turns demo mode on. */
export const DEMO_STORAGE_KEY = 'voyage-ledger.demo';

/** Bump when the shape of DemoState changes, so an old tab's data is replaced by fresh sample data. */
export const DEMO_STATE_VERSION = 1;

/** Ids of the sample data start with this; records added during the visit get other ids. */
export const SAMPLE_ID_PREFIX = 'sample-';

/** Short delay on every demo response, so loading states show the way they do against the real API. */
export const DEMO_LATENCY_MS = 150;

/** Days an invite sent in the demo stays valid, like the real backend. */
export const DEMO_INVITE_DAYS = 7;

export const DEMO_MESSAGES = {
  sampleDelete: "Sample data can't be deleted in the demo.",
  notInDemo: "This isn't available in the demo. Sign up to use it.",
  notFound: 'Not found.',
  splitTotal: 'Split amounts must add up to the total',
  splitPayerOnly: 'Only the person who paid can adjust the split',
  creatorOnly: 'Only the trip creator can do this.',
  alreadyMember: 'This person is already on the trip.',
  alreadyInvited: 'This person already has a pending invite.',
  invalidEmail: 'Enter a valid email address.',
  missingTripFields: 'Missing required fields: name, destination, startDate, endDate',
  missingExpenseFields: 'Missing required fields: tripId, category, amount, date',
} as const;

/**
 * Coordinates for destinations a visitor is likely to type, so trips added in the demo
 * get a map pin without calling the real geocoder. Keys are lowercase destination names.
 */
export const DEMO_PLACES: Record<string, [lat: number, lng: number]> = {
  // India
  agra: [27.1767, 78.0081],
  alleppey: [9.4981, 76.3388],
  alappuzha: [9.4981, 76.3388],
  amritsar: [31.634, 74.8723],
  andaman: [11.6234, 92.7265],
  'port blair': [11.6234, 92.7265],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  coorg: [12.4244, 75.7382],
  darjeeling: [27.041, 88.2663],
  delhi: [28.6139, 77.209],
  'new delhi': [28.6139, 77.209],
  gangtok: [27.3389, 88.6065],
  goa: [15.4909, 73.8278],
  hampi: [15.335, 76.46],
  hyderabad: [17.385, 78.4867],
  jaipur: [26.9124, 75.7873],
  jaisalmer: [26.9157, 70.9083],
  kochi: [9.9312, 76.2673],
  kodaikanal: [10.2381, 77.4892],
  kolkata: [22.5726, 88.3639],
  leh: [34.1526, 77.5771],
  ladakh: [34.1526, 77.5771],
  madurai: [9.9252, 78.1198],
  manali: [32.2432, 77.1892],
  mumbai: [19.076, 72.8777],
  munnar: [10.0889, 77.0595],
  mysore: [12.2958, 76.6394],
  mysuru: [12.2958, 76.6394],
  ooty: [11.4102, 76.695],
  pondicherry: [11.9416, 79.8083],
  puducherry: [11.9416, 79.8083],
  pune: [18.5204, 73.8567],
  rishikesh: [30.0869, 78.2676],
  shimla: [31.1048, 77.1734],
  udaipur: [24.5854, 73.7125],
  varanasi: [25.3176, 82.9739],
  // Rest of the world
  amsterdam: [52.3676, 4.9041],
  bali: [-8.3405, 115.092],
  bangkok: [13.7563, 100.5018],
  barcelona: [41.3874, 2.1686],
  colombo: [6.9271, 79.8612],
  dubai: [25.2048, 55.2708],
  istanbul: [41.0082, 28.9784],
  kathmandu: [27.7172, 85.324],
  kyoto: [35.0116, 135.7681],
  london: [51.5072, -0.1276],
  male: [4.1755, 73.5093],
  maldives: [4.1755, 73.5093],
  'new york': [40.7128, -74.006],
  paris: [48.8566, 2.3522],
  phuket: [7.8804, 98.3923],
  prague: [50.0755, 14.4378],
  rome: [41.9028, 12.4964],
  'san francisco': [37.7749, -122.4194],
  seoul: [37.5665, 126.978],
  singapore: [1.3521, 103.8198],
  sydney: [-33.8688, 151.2093],
  tokyo: [35.6762, 139.6503],
  zurich: [47.3769, 8.5417],
};
