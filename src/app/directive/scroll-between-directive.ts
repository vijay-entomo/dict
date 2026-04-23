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
  selector: '[scrollBetween]',
  standalone: true,
})
export class ScrollBetweenDirective implements AfterViewInit, OnDestroy {
  @Input() startTarget!: HTMLElement;
  @Input() endTarget!: HTMLElement;

  @Input() progressVar = '--scroll-progress';
  @Input() debug = false;
  @Input() smoothing = 0.12;

  private static instances = new Set<ScrollBetweenDirective>();
  private static initialized = false;
  private static rafId: number | null = null;
  private static debugOverlayHost: HTMLElement | null = null;

  private readonly host: HTMLElement;
  private readonly isBrowser: boolean;

  private currentProgress = 0;
  private targetProgress = 0;

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
    if (!this.isBrowser || !this.startTarget || !this.endTarget) return;

    ScrollBetweenDirective.instances.add(this);
    this.ensureSetup();
    this.setProgress(0);

    if (this.debug) {
      this.ensureDebugOverlayHost();
      this.createDebugMarkers();
    }

    this.updateTargetProgress();
    ScrollBetweenDirective.startLoop();
  }

  ngOnDestroy(): void {
    this.removeDebugMarkers();
    ScrollBetweenDirective.instances.delete(this);

    if (ScrollBetweenDirective.instances.size === 0) {
      this.teardown();
    }
  }

  private ensureSetup(): void {
    if (ScrollBetweenDirective.initialized) return;

    ScrollBetweenDirective.initialized = true;

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', ScrollBetweenDirective.onScroll, {
        passive: true,
      });
      window.addEventListener('resize', ScrollBetweenDirective.onResize, {
        passive: true,
      });
    });
  }

  private teardown(): void {
    window.removeEventListener('scroll', ScrollBetweenDirective.onScroll);
    window.removeEventListener('resize', ScrollBetweenDirective.onResize);

    if (ScrollBetweenDirective.rafId !== null) {
      cancelAnimationFrame(ScrollBetweenDirective.rafId);
      ScrollBetweenDirective.rafId = null;
    }

    ScrollBetweenDirective.initialized = false;

    if (ScrollBetweenDirective.debugOverlayHost) {
      ScrollBetweenDirective.debugOverlayHost.remove();
      ScrollBetweenDirective.debugOverlayHost = null;
    }
  }

  private static onScroll = (): void => {
    for (const instance of ScrollBetweenDirective.instances) {
      instance.updateTargetProgress();
    }
    ScrollBetweenDirective.startLoop();
  };

  private static onResize = (): void => {
    for (const instance of ScrollBetweenDirective.instances) {
      instance.updateTargetProgress();
    }
    ScrollBetweenDirective.startLoop();
  };

  private static startLoop(): void {
    if (ScrollBetweenDirective.rafId !== null) return;

    const tick = () => {
      let hasActiveAnimation = false;

      for (const instance of ScrollBetweenDirective.instances) {
        const stillAnimating = instance.animateTowardsTarget();
        if (stillAnimating) hasActiveAnimation = true;
      }

      if (hasActiveAnimation) {
        ScrollBetweenDirective.rafId = requestAnimationFrame(tick);
      } else {
        ScrollBetweenDirective.rafId = null;
      }
    };

    ScrollBetweenDirective.rafId = requestAnimationFrame(tick);
  }

  private updateTargetProgress(): void {
    const startY = this.getPageTop(this.startTarget);
    const endY = this.getPageTop(this.endTarget);
    const currentY = window.scrollY;

    const total = endY - startY;

    let progress = 0;

    if (total <= 0) {
      progress = currentY >= endY ? 1 : 0;
    } else {
      progress = (currentY - startY) / total;
    }

    this.targetProgress = this.clamp(progress, 0, 1);

    if (this.debug) {
      this.updateDebugMarkers(startY, endY, this.currentProgress, this.targetProgress);
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
      return false;
    }

    this.currentProgress += delta * smoothing;
    this.setProgress(this.currentProgress);
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

  private getPageTop(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    return rect.top + window.scrollY;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private ensureDebugOverlayHost(): void {
    if (ScrollBetweenDirective.debugOverlayHost) return;

    const overlay = this.renderer.createElement('div') as HTMLElement;
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '999999';

    this.document.body.appendChild(overlay);
    ScrollBetweenDirective.debugOverlayHost = overlay;
  }

  private createDebugMarkers(): void {
    const overlay = ScrollBetweenDirective.debugOverlayHost;
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

    const badge = this.renderer.createElement('div') as HTMLElement;
    badge.textContent = label;
    badge.style.position = 'absolute';
    badge.style.left = '12px';
    badge.style.top = '-12px';
    badge.style.padding = '2px 6px';
    badge.style.fontSize = '11px';
    badge.style.fontFamily = 'monospace';
    badge.style.color = '#fff';
    badge.style.background = color;
    badge.style.borderRadius = '4px';

    marker.appendChild(badge);
    return marker;
  }

  private updateDebugMarkers(
    startY: number,
    endY: number,
    currentProgress: number,
    targetProgress: number,
  ): void {
    const viewportStart = startY - window.scrollY;
    const viewportEnd = endY - window.scrollY;

    if (this.startMarkerEl) {
      this.startMarkerEl.style.top = `${viewportStart}px`;
      const badge = this.startMarkerEl.firstElementChild as HTMLElement | null;
      if (badge) badge.textContent = `START current=${currentProgress.toFixed(2)}`;
    }

    if (this.endMarkerEl) {
      this.endMarkerEl.style.top = `${viewportEnd}px`;
      const badge = this.endMarkerEl.firstElementChild as HTMLElement | null;
      if (badge) badge.textContent = `END target=${targetProgress.toFixed(2)}`;
    }
  }

  private removeDebugMarkers(): void {
    this.startMarkerEl?.remove();
    this.endMarkerEl?.remove();
    this.startMarkerEl = null;
    this.endMarkerEl = null;
  }
}
