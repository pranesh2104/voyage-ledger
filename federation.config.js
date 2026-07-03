import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config.js';

export default withNativeFederation({
  name: 'voyage-ledger',

  remotes: {
    'voyage-ui': 'http://localhost:4202/remoteEntry.json',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // voyage-ui is linked as a package.json dependency purely so TypeScript can
    // resolve `import type` for the federated remote's types - shareAll() would
    // otherwise also bundle it as a shared singleton, colliding with its real
    // identity as a `remotes` entry loaded via loadRemoteModule at runtime.
    'voyage-ui',
  ],

  // Please read our FAQ about sharing libs:
  // https://shorturl.at/jmzH0

  features: {
    // New feature for more performance and avoiding
    // issues with node libs. Comment this out to
    // get the traditional behavior:
    ignoreUnusedDeps: true
  }
});
