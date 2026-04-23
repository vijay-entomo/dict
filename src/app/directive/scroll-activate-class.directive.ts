import {
  Directive,
  ElementRef,
  Input,
  AfterViewInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  NgZone,
  Renderer2,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[scrollActivateClass]',
  standalone: true,
})
export class ScrollActivateClassDirective implements AfterViewInit, OnDestroy {
  @Input('scrollActivateClass') activeClass = '';
  @Input() inactiveClass = '';

  /** Examples: "top 40%", "center 60%", "bottom 200px" */
  @Input() start = 'top 40%';

  /** Examples: "bottom 0px", "center 80px" */
  @Input() end = 'bottom 0px';

  @Input() activateOnce = false;
  @Input() debug = false;

  private static instances = new Set<ScrollActivateClassDirective>();
  private static initialized = false;
  private static ticking = false;

  private static debugOverlayHost: HTMLElement | null = null;

  private readonly host: HTMLElement;
  private readonly isBrowser: boolean;

  private isActive = false;
  private hasActivatedOnce = false;

  private startMarkerEl: HTMLElement | null = null;
  private endMarkerEl: HTMLElement | null = null;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private ngZone: NgZone,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.host = this.el.nativeElement;
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.activeClass.trim()) return;

    ScrollActivateClassDirective.instances.add(this);
    this.ensureSetup();
    this.applyInitialState();

    if (this.debug) {
      this.ensureDebugOverlayHost();
      this.createDebugMarkers();
    }

    ScrollActivateClassDirective.scheduleUpdate();
  }

  ngOnDestroy(): void {
    this.removeDebugMarkers();
    ScrollActivateClassDirective.instances.delete(this);

    if (ScrollActivateClassDirective.instances.size === 0) {
      this.teardown();
    }
  }

  private ensureSetup(): void {
    if (ScrollActivateClassDirective.initialized) return;

    ScrollActivateClassDirective.initialized = true;

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', ScrollActivateClassDirective.onScroll, {
        passive: true,
      });
      window.addEventListener('resize', ScrollActivateClassDirective.onResize, {
        passive: true,
      });
    });
  }

  private teardown(): void {
    window.removeEventListener('scroll', ScrollActivateClassDirective.onScroll);
    window.removeEventListener('resize', ScrollActivateClassDirective.onResize);

    ScrollActivateClassDirective.initialized = false;
    ScrollActivateClassDirective.ticking = false;

    if (ScrollActivateClassDirective.debugOverlayHost) {
      ScrollActivateClassDirective.debugOverlayHost.remove();
      ScrollActivateClassDirective.debugOverlayHost = null;
    }
  }

  private static onScroll = (): void => {
    ScrollActivateClassDirective.scheduleUpdate();
  };

  private static onResize = (): void => {
    ScrollActivateClassDirective.scheduleUpdate();
  };

  private static scheduleUpdate(): void {
    if (ScrollActivateClassDirective.ticking || ScrollActivateClassDirective.instances.size === 0) {
      return;
    }

    ScrollActivateClassDirective.ticking = true;

    requestAnimationFrame(() => {
      ScrollActivateClassDirective.ticking = false;

      for (const instance of ScrollActivateClassDirective.instances) {
        instance.updateState();
      }
    });
  }

  private updateState(): void {
    if (this.activateOnce && this.hasActivatedOnce) return;

    const rect = this.host.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.height <= 0) {
      this.setInactive();
      return;
    }

    const startLine = this.resolveViewportPosition(this.start, viewportHeight);
    const endLine = this.resolveViewportPosition(this.end, viewportHeight);

    const elementStart = this.resolveElementAnchor(this.start, rect);
    const elementEnd = this.resolveElementAnchor(this.end, rect);

    const isNowActive = elementStart <= startLine && elementEnd > endLine;

    if (isNowActive) {
      this.setActive();
    } else {
      this.setInactive();
    }

    if (this.debug) {
      this.updateDebugMarkers(startLine, endLine);
    }
  }

  private resolveViewportPosition(value: string, viewportHeight: number): number {
    const parts = value.trim().split(/\s+/);
    if (parts.length < 2) return 0;

    const viewportPart = parts[1];

    if (viewportPart.endsWith('%')) {
      const percent = parseFloat(viewportPart);
      return Number.isFinite(percent) ? viewportHeight * (percent / 100) : 0;
    }

    if (viewportPart.endsWith('px')) {
      const px = parseFloat(viewportPart);
      return Number.isFinite(px) ? px : 0;
    }

    return 0;
  }

  private resolveElementAnchor(value: string, rect: DOMRect): number {
    const parts = value.trim().split(/\s+/);
    const anchor = parts[0];

    switch (anchor) {
      case 'top':
        return rect.top;
      case 'center':
        return rect.top + rect.height / 2;
      case 'bottom':
        return rect.bottom;
      default:
        return rect.top;
    }
  }

  private applyInitialState(): void {
    if (this.inactiveClass.trim()) {
      this.renderer.addClass(this.host, this.inactiveClass);
    }
  }

  private setActive(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.hasActivatedOnce = true;

    if (this.inactiveClass.trim()) {
      this.renderer.removeClass(this.host, this.inactiveClass);
    }

    this.renderer.addClass(this.host, this.activeClass);
  }

  private setInactive(): void {
    if (!this.isActive) return;
    if (this.activateOnce && this.hasActivatedOnce) return;

    this.isActive = false;

    this.renderer.removeClass(this.host, this.activeClass);

    if (this.inactiveClass.trim()) {
      this.renderer.addClass(this.host, this.inactiveClass);
    }
  }

  private ensureDebugOverlayHost(): void {
    if (ScrollActivateClassDirective.debugOverlayHost) return;

    const host = this.renderer.createElement('div') as HTMLElement;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '999999';

    this.document.body.appendChild(host);
    ScrollActivateClassDirective.debugOverlayHost = host;
  }

  private createDebugMarkers(): void {
    const overlay = ScrollActivateClassDirective.debugOverlayHost;
    if (!overlay) return;

    this.startMarkerEl = this.createMarker('START', '#16a34a');
    this.endMarkerEl = this.createMarker('END', '#dc2626');

    overlay.appendChild(this.startMarkerEl);
    overlay.appendChild(this.endMarkerEl);
  }

  private createMarker(label: string, color: string): HTMLElement {
    const marker = this.renderer.createElement('div') as HTMLElement;
    marker.style.position = 'absolute';
    marker.style.left = '0';
    marker.style.width = '100%';
    marker.style.height = '0';
    marker.style.borderTop = `2px dashed ${color}`;
    marker.style.pointerEvents = 'none';

    const badge = this.renderer.createElement('div') as HTMLElement;
    badge.textContent = label;
    badge.style.position = 'absolute';
    badge.style.left = '12px';
    badge.style.top = '-12px';
    badge.style.padding = '2px 6px';
    badge.style.fontSize = '11px';
    badge.style.lineHeight = '1';
    badge.style.fontFamily = 'monospace';
    badge.style.color = '#fff';
    badge.style.background = color;
    badge.style.borderRadius = '4px';

    marker.appendChild(badge);
    return marker;
  }

  private updateDebugMarkers(startLine: number, endLine: number): void {
    if (this.startMarkerEl) {
      this.startMarkerEl.style.top = `${startLine}px`;
      const badge = this.startMarkerEl.firstElementChild as HTMLElement | null;
      if (badge) badge.textContent = `START ${this.start}`;
    }

    if (this.endMarkerEl) {
      this.endMarkerEl.style.top = `${endLine}px`;
      const badge = this.endMarkerEl.firstElementChild as HTMLElement | null;
      if (badge) badge.textContent = `END ${this.end}`;
    }
  }

  private removeDebugMarkers(): void {
    this.startMarkerEl?.remove();
    this.endMarkerEl?.remove();
    this.startMarkerEl = null;
    this.endMarkerEl = null;
  }
}


// <section
//   scrollActivateClass="section--active"
//   inactiveClass="section--inactive"
//   start="top 40%"
//   end="bottom 80px"
//   [debug]="true"
// >
//   ...
// </section>