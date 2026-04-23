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
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[scrollOffsetClass]',
  standalone: true,
})
export class ScrollOffsetClassDirective implements AfterViewInit, OnDestroy {
  @Input('scrollOffsetClass') activeClass = '';
  @Input() inactiveClass = '';
  @Input() scrollOffset = 0;
  @Input() scrollOffsetOnce = false;

  private static instances = new Set<ScrollOffsetClassDirective>();
  private static initialized = false;
  private static ticking = false;

  private static readonly onScroll = (): void => {
    ScrollOffsetClassDirective.scheduleUpdate();
  };

  private static readonly onResize = (): void => {
    ScrollOffsetClassDirective.scheduleUpdate();
  };

  private readonly isBrowser: boolean;
  private readonly host: HTMLElement;

  private isActive = false;
  private hasActivatedOnce = false;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.host = this.el.nativeElement;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.activeClass) return;

    ScrollOffsetClassDirective.instances.add(this);
    this.ensureSetup();
    this.applyInitialState();
    ScrollOffsetClassDirective.scheduleUpdate();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    ScrollOffsetClassDirective.instances.delete(this);

    if (ScrollOffsetClassDirective.instances.size === 0) {
      this.teardown();
    }
  }

  private ensureSetup(): void {
    if (ScrollOffsetClassDirective.initialized) return;

    ScrollOffsetClassDirective.initialized = true;

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', ScrollOffsetClassDirective.onScroll, {
        passive: true,
      });
      window.addEventListener('resize', ScrollOffsetClassDirective.onResize, {
        passive: true,
      });
    });
  }

  private teardown(): void {
    if (!ScrollOffsetClassDirective.initialized) return;

    window.removeEventListener('scroll', ScrollOffsetClassDirective.onScroll);
    window.removeEventListener('resize', ScrollOffsetClassDirective.onResize);

    ScrollOffsetClassDirective.initialized = false;
    ScrollOffsetClassDirective.ticking = false;
  }

  private static scheduleUpdate(): void {
    if (ScrollOffsetClassDirective.ticking || ScrollOffsetClassDirective.instances.size === 0) {
      return;
    }

    ScrollOffsetClassDirective.ticking = true;

    requestAnimationFrame(() => {
      ScrollOffsetClassDirective.ticking = false;

      for (const instance of ScrollOffsetClassDirective.instances) {
        instance.updateState();
      }
    });
  }

  private updateState(): void {
    if (this.scrollOffsetOnce && this.hasActivatedOnce) return;

    const offset = Math.max(0, this.scrollOffset);
    const isNowActive = window.scrollY > offset;

    if (isNowActive) {
      this.setActive();
    } else {
      this.setInactive();
    }
  }

  private applyInitialState(): void {
    if (this.inactiveClass) {
      this.renderer.addClass(this.host, this.inactiveClass);
    }
  }

  private setActive(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.hasActivatedOnce = true;

    if (this.inactiveClass) {
      this.renderer.removeClass(this.host, this.inactiveClass);
    }

    this.renderer.addClass(this.host, this.activeClass);
  }

  private setInactive(): void {
    if (!this.isActive) return;
    if (this.scrollOffsetOnce && this.hasActivatedOnce) return;

    this.isActive = false;
    this.renderer.removeClass(this.host, this.activeClass);

    if (this.inactiveClass) {
      this.renderer.addClass(this.host, this.inactiveClass);
    }
  }
}

// <header
//   scrollOffsetClass="header--scrolled"
//   inactiveClass="header--top"
//   [scrollOffset]="80"
// >
//   ...
// </header>