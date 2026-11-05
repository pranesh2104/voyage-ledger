import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'voyage-ledger',


  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Only the shell's My Journey page uses MapLibre, so bundle it as a normal
    // lazy chunk instead of a federation-shared package.
    'maplibre-gl',
    // Add further packages you don't need at runtime
  ],

  // No remote imports voyage-ledger's internal @core/@shared path aliases
  // (voyage-expense only depends on the published voyage-lib package), so
  // there's nothing to federate-share here — opt out rather than restructure
  // internal imports into barrels just to satisfy v22's stricter mapping check.
  sharedMappings: [],

  // Please read our FAQ about sharing libs:
  // https://shorturl.at/jmzH0

  features: {
    // New feature for more performance and avoiding
    // issues with node libs. Comment this out to
    // get the traditional behavior:
    ignoreUnusedDeps: true
  }
});
