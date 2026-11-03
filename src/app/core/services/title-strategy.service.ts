import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

const SITE_ORIGIN = 'https://www.voyageledger.in';
const DEFAULT_TITLE = 'Voyage Ledger - Track Your Travel Expenses';

@Injectable({ providedIn: 'root' })
export class CustomTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(routerState: RouterStateSnapshot): void {
    const deepest = this.deepestChild(routerState.root);

    // Routes declare their title under `data.title`; buildTitle() only reads
    // the route-level `title` property, so fall back to data for those routes.
    const title = this.buildTitle(routerState) ?? deepest.data['title'];
    this.title.setTitle(title ? `${title} - Voyage Ledger` : DEFAULT_TITLE);

    this.updateCanonical(routerState.url);
    this.updateRobots(deepest.routeConfig?.path === '**');
  }

  private deepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    while (route.firstChild) route = route.firstChild;
    return route;
  }

  /** One canonical URL per page, without query string or fragment. */
  private updateCanonical(url: string): void {
    const path = url.split(/[?#]/)[0];
    const href = SITE_ORIGIN + (path === '/' ? '/' : path.replace(/\/$/, ''));

    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = href;
  }

  /** Keep the catch-all "not found" page out of the index (avoids soft-404s). */
  private updateRobots(isNotFound: boolean): void {
    if (isNotFound) {
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
    } else {
      this.meta.removeTag('name="robots"');
    }
  }
}
