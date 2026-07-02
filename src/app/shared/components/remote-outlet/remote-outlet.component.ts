import { Component, effect, input, Type, viewChild } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

/**
 * Renders a component class resolved at runtime (e.g. from a Native Federation
 * remote) via NgComponentOutlet. `content` must be a referentially-stable
 * Node[][] built once — NgComponentOutlet recreates the child whenever its
 * identity changes. `outputBindings` must be a referentially-stable object:
 * only the closures present the first time the instance appears get wired.
 */
@Component({
  selector: 'app-remote-outlet',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `
    @if (component(); as cmp) {
      <ng-container
        [ngComponentOutlet]="cmp"
        [ngComponentOutletInputs]="inputs()"
        [ngComponentOutletContent]="content()" />
    }
  `,
})
export class RemoteOutletComponent<T = unknown> {
  component = input<Type<T> | null | undefined>(null);
  inputs = input<Record<string, unknown>>({});
  content = input<Node[][]>([]);
  outputBindings = input<Record<string, (value: unknown) => void>>({});

  private readonly outletDirective = viewChild(NgComponentOutlet);
  private wiredInstance: unknown;

  constructor() {
    effect(() => {
      const instance = this.outletDirective()?.componentInstance;
      if (!instance || instance === this.wiredInstance) return;
      this.wiredInstance = instance;
      for (const [name, handler] of Object.entries(this.outputBindings())) {
        const emitter = (instance as Record<string, unknown>)[name] as
          | { subscribe(cb: (value: unknown) => void): unknown }
          | undefined;
        emitter?.subscribe(handler);
      }
    });
  }
}
