import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DEMO_STATE_VERSION, DEMO_STORAGE_KEY } from './demo.constant';
import { DemoState } from './demo.model';
import { buildDemoSeed } from './demo-seed';
import { isSampleId } from './demo-api';

/**
 * Holds the demo data. It lives in sessionStorage: it survives reloads, stays separate per
 * tab, and is gone once the tab is closed, so one visitor's changes never reach anyone else
 * and nothing is ever sent to the real backend.
 */
@Injectable({ providedIn: 'root' })
export class DemoStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private current: DemoState | null = this.load();

  /** True while the visitor is exploring the demo. */
  readonly active = signal(this.current !== null);

  get state(): DemoState | null {
    return this.current;
  }

  /** Starts the demo with fresh sample data, or keeps the data of a demo already running in this tab. */
  start(): void {
    if (!this.current) {
      this.current = buildDemoSeed();
      this.save();
    }
    this.active.set(true);
  }

  /** Puts the sample data back the way it was at the start. */
  reset(): void {
    this.current = buildDemoSeed();
    this.save();
  }

  end(): void {
    this.current = null;
    if (this.isBrowser) sessionStorage.removeItem(DEMO_STORAGE_KEY);
    this.active.set(false);
  }

  save(): void {
    if (this.isBrowser && this.current) sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(this.current));
  }

  /** True for the sample trips, expenses and people the demo starts with (they can't be deleted). */
  isSample(id: string | null | undefined): boolean {
    return this.active() && isSampleId(id);
  }

  private load(): DemoState | null {
    if (!this.isBrowser) return null;
    try {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as DemoState;
      // Data saved by an older version of the demo: start over with the current sample data.
      return state.version === DEMO_STATE_VERSION ? state : buildDemoSeed();
    } catch {
      return null;
    }
  }
}
