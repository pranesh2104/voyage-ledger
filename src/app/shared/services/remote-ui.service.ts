import { Injectable } from '@angular/core';
import { loadRemoteModule } from '@angular-architects/native-federation';
import type * as VoyageUi from 'voyage-ui/ui';

@Injectable({ providedIn: 'root' })
export class RemoteUiService {
  private modulePromise: Promise<typeof VoyageUi> | null = null;

  load(): Promise<typeof VoyageUi> {
    if (!this.modulePromise) {
      this.modulePromise = loadRemoteModule('voyage-ui', './ui') as Promise<typeof VoyageUi>;
    }
    return this.modulePromise;
  }
}
