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
  RendererStyleFlags2,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[scrollProgress]',
  standalone: true,
})
export class ScrollProgressDirective implements AfterViewInit, OnDestroy {
  @Input() start = 'top 100%';
  @Input() end = 'bottom 100%';

  @Input() startOffset = 0;
  @Input() endOffset = 0;

  @Input() progressVar = '--scroll-progress';
  @Input() debug = false;

  @Input() smoothing = 0.12;

  private static instances = new Set<ScrollProgressDirective>();
  private static initialized = false;
  private static rafId: number | null = null;

  private static debugOverlayHost: HTMLElement | null = null;

  private readonly host: HTMLElement;
  private readonly isBrowser: boolean;

  private startMarkerEl: HTMLElement | null = null;
  private endMarkerEl: HTMLElement | null = null;

  private targetProgress = 0;
  private currentProgress = 0;

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
    if (!this.isBrowser) return;

    ScrollProgressDirective.instances.add(this);
    this.ensureSetup();

    this.setProgress(0);

    if (this.debug) {
      this.ensureDebugOverlayHost();
      this.createDebugMarkers();
    }

    this.updateTargetProgress();
    ScrollProgressDirective.startLoop();
  }

  ngOnDestroy(): void {
    this.removeDebugMarkers();
    ScrollProgressDirective.instances.delete(this);

    if (ScrollProgressDirective.instances.size === 0) {
      this.teardown();
    }
  }

  private ensureSetup(): void {
    if (ScrollProgressDirective.initialized) return;

    ScrollProgressDirective.initialized = true;

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', ScrollProgressDirective.onScroll, {
        passive: true,
      });
      window.addEventListener('resize', ScrollProgressDirective.onResize, {
        passive: true,
      });
    });
  }

  private teardown(): void {
    window.removeEventListener('scroll', ScrollProgressDirective.onScroll);
    window.removeEventListener('resize', ScrollProgressDirective.onResize);

    if (ScrollProgressDirective.rafId !== null) {
      cancelAnimationFrame(ScrollProgressDirective.rafId);
      ScrollProgressDirective.rafId = null;
    }

    ScrollProgressDirective.initialized = false;

    if (ScrollProgressDirective.debugOverlayHost) {
      ScrollProgressDirective.debugOverlayHost.remove();
      ScrollProgressDirective.debugOverlayHost = null;
    }
  }

  private static onScroll = (): void => {
    for (const instance of ScrollProgressDirective.instances) {
      instance.updateTargetProgress();
    }
    ScrollProgressDirective.startLoop();
  };

  private static onResize = (): void => {
    for (const instance of ScrollProgressDirective.instances) {
      instance.updateTargetProgress();
    }
    ScrollProgressDirective.startLoop();
  };

  private static startLoop(): void {
    if (ScrollProgressDirective.rafId !== null) return;

    const tick = () => {
      let hasActiveAnimation = false;

      for (const instance of ScrollProgressDirective.instances) {
        const stillAnimating = instance.animateTowardsTarget();
        if (stillAnimating) {
          hasActiveAnimation = true;
        }
      }

      if (hasActiveAnimation) {
        ScrollProgressDirective.rafId = requestAnimationFrame(tick);
      } else {
        ScrollProgressDirective.rafId = null;
      }
    };

    ScrollProgressDirective.rafId = requestAnimationFrame(tick);
  }

  private updateTargetProgress(): void {
    const rect = this.host.getBoundingClientRect();
    const vh = window.innerHeight;

    if (rect.height <= 0 && rect.width <= 0) {
      this.targetProgress = 0;
      return;
    }

    const startLine =
      this.resolveViewportPosition(this.start, vh) - this.normalizeOffset(this.startOffset);
    const endLine =
      this.resolveViewportPosition(this.end, vh) + this.normalizeOffset(this.endOffset);

    const startAnchor = this.resolveElementAnchor(this.start, rect);
    const endAnchor = this.resolveElementAnchor(this.end, rect);

    // Total distance = (Vertical distance between scroller triggers) + (Vertical span between element anchors)
    const totalDistance = startLine - endLine + (endAnchor - startAnchor);

    if (Math.abs(totalDistance) <= 1e-6) {
      this.targetProgress = startAnchor <= startLine ? 1 : 0;
    } else {
      this.targetProgress = this.clamp((startLine - startAnchor) / totalDistance, 0, 1);
    }

    if (this.debug) {
      this.updateDebugMarkers(startLine, endLine, this.currentProgress, this.targetProgress);
    }
  }

  private animateTowardsTarget(): boolean {
    const smoothing = this.clamp(this.smoothing, 0, 1);

    if (smoothing === 0) {
      this.currentProgress = this.targetProgress;
      this.setProgress(this.currentProgress);
      return false;
    }

    const delta = this.targetProgress - this.currentProgress;

    if (Math.abs(delta) < 0.001) {
      this.currentProgress = this.targetProgress;
      this.setProgress(this.currentProgress);

      if (this.debug) {
        const rect = this.host.getBoundingClientRect();
        const vh = window.innerHeight;
        const startLine = Math.max(
          0,
          this.resolveViewportPosition(this.start, vh) - this.normalizeOffset(this.startOffset),
        );
        const endLine = Math.max(
          0,
          this.resolveViewportPosition(this.end, vh) + this.normalizeOffset(this.endOffset),
        );
        this.updateDebugMarkers(startLine, endLine, this.currentProgress, this.targetProgress);
      }

      return false;
    }

    this.currentProgress += delta * smoothing;
    this.setProgress(this.currentProgress);

    if (this.debug) {
      const vh = window.innerHeight;
      const startLine =
        this.resolveViewportPosition(this.start, vh) - this.normalizeOffset(this.startOffset);
      const endLine =
        this.resolveViewportPosition(this.end, vh) + this.normalizeOffset(this.endOffset);
      this.updateDebugMarkers(startLine, endLine, this.currentProgress, this.targetProgress);
    }

    return true;
  }

  private setProgress(value: number): void {
    this.renderer.setStyle(
      this.host,
      this.progressVar,
      value.toFixed(4),
      RendererStyleFlags2.DashCase,
    );
  }

  private resolveViewportPosition(value: string, vh: number): number {
    const parts = value.trim().split(/\s+/);
    // Be robust with one-word inputs like "center" or "bottom"
    const viewportPart = (parts.length >= 2 ? parts[1] : parts[0]).toLowerCase();

    if (viewportPart === 'top') return 0;
    if (viewportPart === 'center' || viewportPart === 'middle') return vh * 0.5;
    if (viewportPart === 'bottom') return vh;

    if (viewportPart.endsWith('%')) {
      const num = parseFloat(viewportPart);
      return Number.isFinite(num) ? vh * (num / 100) : 0;
    }

    if (viewportPart.endsWith('px')) {
      const num = parseFloat(viewportPart);
      return Number.isFinite(num) ? num : 0;
    }

    const num = parseFloat(viewportPart);
    return Number.isFinite(num) ? num : 0;
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

  private normalizeOffset(value: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return value;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private ensureDebugOverlayHost(): void {
    if (ScrollProgressDirective.debugOverlayHost) return;

    const overlay = this.renderer.createElement('div') as HTMLElement;
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '999999';

    this.document.body.appendChild(overlay);
    ScrollProgressDirective.debugOverlayHost = overlay;
  }

  private createDebugMarkers(): void {
    const overlay = ScrollProgressDirective.debugOverlayHost;
    if (!overlay) return;

    this.startMarkerEl = this.createMarker('SCROLL-START', '#2ecc71'); // Lime Green
    this.endMarkerEl = this.createMarker('SCROLL-END', '#e91e63'); // Fuchsia/Pink

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

  private updateDebugMarkers(
    startLine: number,
    endLine: number,
    currentProgress: number,
    targetProgress: number,
  ): void {
    if (this.startMarkerEl) {
      this.startMarkerEl.style.top = `${startLine}px`;
      const badge = this.startMarkerEl.firstElementChild as HTMLElement | null;
      if (badge) {
        badge.textContent = `SCROLL-START (${this.start}) p=${targetProgress.toFixed(3)}`;
      }
    }

    if (this.endMarkerEl) {
      this.endMarkerEl.style.top = `${endLine}px`;
      const badge = this.endMarkerEl.firstElementChild as HTMLElement | null;
      if (badge) {
        badge.textContent = `SCROLL-END (${this.end}) filter=${currentProgress.toFixed(3)}`;
      }
    }
  }

  private removeDebugMarkers(): void {
    this.startMarkerEl?.remove();
    this.endMarkerEl?.remove();
    this.startMarkerEl = null;
    this.endMarkerEl = null;
  }
}

// class="feature-card" scrollProgress start="top 40%" end="bottom 0px" [startOffset]="40" [endOffset]="40" [debug]="true"
