import {
  Directive,
  ElementRef,
  Input,
  AfterViewInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

type ThemeSection = {
  element: HTMLElement;
  theme: string;
};

@Directive({
  selector: '[data-animate-theme-to]',
  standalone: true,
})
export class ThemeScrollDirective implements AfterViewInit, OnDestroy {
  @Input('data-animate-theme-to') themeColor = '';

  // 1. Add an input to toggle debug mode
  @Input() debugTheme: boolean | string = false;

  private static sections = new Map<HTMLElement, ThemeSection>();
  private static activeTheme = '';
  private static initialized = false;
  private static ticking = false;
  private static documentRef: Document | null = null;
  private static ngZoneRef: NgZone | null = null;

  // 2. Track global debug state and the trigger line DOM element
  private static isDebugMode = false;
  private static debugLineEl: HTMLElement | null = null;

  private static onScroll = (): void => {
    ThemeScrollDirective.scheduleUpdate();
  };

  private static onResize = (): void => {
    ThemeScrollDirective.scheduleUpdate();
  };

  private readonly isBrowser: boolean;
  private readonly host: HTMLElement;

  constructor(
    private el: ElementRef<HTMLElement>,
    private ngZone: NgZone,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.host = this.el.nativeElement;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.themeColor) return;

    ThemeScrollDirective.documentRef = this.document;
    ThemeScrollDirective.ngZoneRef = this.ngZone;

    // Check if debug was enabled on ANY instance of this directive
    if (this.debugTheme !== false && this.debugTheme !== 'false') {
      ThemeScrollDirective.isDebugMode = true;
    }

    this.ensureSetup();
    this.setupDebugBoundaries(); // 3. Draw outlines on the sections

    ThemeScrollDirective.sections.set(this.host, {
      element: this.host,
      theme: this.themeColor,
    });

    ThemeScrollDirective.scheduleUpdate();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    ThemeScrollDirective.sections.delete(this.host);
    ThemeScrollDirective.scheduleUpdate();

    if (ThemeScrollDirective.sections.size === 0) {
      this.teardown();
    }
  }

  private setupDebugBoundaries(): void {
    if (!ThemeScrollDirective.isDebugMode) return;

    // Highlight the top and bottom of the element
    this.host.style.outline = `2px dashed ${this.themeColor || 'gray'}`;

    // Ensure relative positioning so the label stays inside
    if (window.getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }

    // Add a label to the top-left of the section
    const label = document.createElement('div');
    label.textContent = `Start Theme: ${this.themeColor}`;
    label.style.position = 'absolute';
    label.style.top = '0';
    label.style.left = '0';
    label.style.background = 'black';
    label.style.color = 'white';
    label.style.padding = '4px 8px';
    label.style.fontSize = '12px';
    label.style.fontFamily = 'monospace';
    label.style.zIndex = '9999';
    this.host.appendChild(label);
  }

  private ensureSetup(): void {
    if (ThemeScrollDirective.initialized) return;

    ThemeScrollDirective.initialized = true;

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', ThemeScrollDirective.onScroll, {
        passive: true,
      });

      window.addEventListener('resize', ThemeScrollDirective.onResize, {
        passive: true,
      });
    });
  }

  private teardown(): void {
    if (!ThemeScrollDirective.initialized) return;

    window.removeEventListener('scroll', ThemeScrollDirective.onScroll);
    window.removeEventListener('resize', ThemeScrollDirective.onResize);

    // 4. Clean up debug line on destroy
    if (ThemeScrollDirective.debugLineEl) {
      ThemeScrollDirective.debugLineEl.remove();
      ThemeScrollDirective.debugLineEl = null;
    }
    ThemeScrollDirective.isDebugMode = false;

    ThemeScrollDirective.initialized = false;
    ThemeScrollDirective.ticking = false;
    ThemeScrollDirective.activeTheme = '';
    ThemeScrollDirective.documentRef = null;
    ThemeScrollDirective.ngZoneRef = null;
  }

  private static scheduleUpdate(): void {
    if (
      ThemeScrollDirective.ticking ||
      !ThemeScrollDirective.documentRef ||
      ThemeScrollDirective.sections.size === 0
    ) {
      return;
    }

    ThemeScrollDirective.ticking = true;

    requestAnimationFrame(() => {
      ThemeScrollDirective.ticking = false;
      ThemeScrollDirective.updateActiveTheme();
    });
  }

  private static updateActiveTheme(): void {
    const doc = ThemeScrollDirective.documentRef;
    if (!doc || ThemeScrollDirective.sections.size === 0) return;

    // Fixed the math here: 0.4 represents 40% of the viewport height.
    // Your previous code used 1, which was 100% (the bottom of the screen).
    const triggerLine = window.innerHeight * 0.5;

    // 5. Update the red debug line position
    if (ThemeScrollDirective.isDebugMode) {
      ThemeScrollDirective.drawDebugTriggerLine(triggerLine);
    }

    let containingSection: ThemeSection | null = null;
    let closestSection: ThemeSection | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const section of ThemeScrollDirective.sections.values()) {
      const rect = section.element.getBoundingClientRect();

      if (rect.height === 0) continue;

      const containsTriggerLine = rect.top <= triggerLine && rect.bottom >= triggerLine;

      if (containsTriggerLine) {
        containingSection = section;
        break;
      }

      const distanceToTriggerLine = ThemeScrollDirective.getDistanceToRange(
        triggerLine,
        rect.top,
        rect.bottom,
      );

      if (distanceToTriggerLine < closestDistance) {
        closestDistance = distanceToTriggerLine;
        closestSection = section;
      }
    }

    const nextTheme = containingSection?.theme ?? closestSection?.theme ?? '';

    if (nextTheme && nextTheme !== ThemeScrollDirective.activeTheme) {
      ThemeScrollDirective.activeTheme = nextTheme;
      doc.body.setAttribute('data-theme', nextTheme);
    }
  }

  private static drawDebugTriggerLine(triggerLine: number): void {
    if (!ThemeScrollDirective.debugLineEl) {
      const line = document.createElement('div');
      line.style.position = 'fixed';
      line.style.left = '0';
      line.style.right = '0';
      line.style.height = '2px';
      line.style.backgroundColor = 'red';
      line.style.zIndex = '10000';
      line.style.pointerEvents = 'none'; // Prevents it from blocking clicks

      const label = document.createElement('span');
      label.textContent = 'Trigger Line (40% vh)';
      label.style.position = 'absolute';
      label.style.right = '10px';
      label.style.bottom = '2px';
      label.style.color = 'red';
      label.style.fontSize = '12px';
      label.style.fontFamily = 'monospace';
      label.style.fontWeight = 'bold';

      line.appendChild(label);
      document.body.appendChild(line);
      ThemeScrollDirective.debugLineEl = line;
    }
    // Update Y position (useful if user resizes window)
    ThemeScrollDirective.debugLineEl.style.top = `${triggerLine}px`;
  }

  private static getDistanceToRange(point: number, rangeStart: number, rangeEnd: number): number {
    if (point < rangeStart) return rangeStart - point;
    if (point > rangeEnd) return point - rangeEnd;
    return 0;
  }
}
