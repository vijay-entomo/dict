import { Directive, ElementRef, HostListener, AfterViewInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appAutoFitText]',
  standalone: true,
})
export class AutoFitTextDirective implements AfterViewInit, OnDestroy {
  private resizeObserver?: ResizeObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.adjustFontSize();
    if ('ResizeObserver' in window && this.el.nativeElement.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.adjustFontSize());
      this.resizeObserver.observe(this.el.nativeElement.parentElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.adjustFontSize();
  }

  private adjustFontSize(): void {
    const element = this.el.nativeElement;
    const parent = element.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();

    // CSS font-size as starting max
    const style = window.getComputedStyle(element);
    let fontSize = parseFloat(style.fontSize) || 16;

    const minFontSize = 4;
    const tolerance = 1; // pixels

    // Word-safe CSS
    element.style.whiteSpace = 'normal';
    element.style.wordBreak = 'normal';
    element.style.overflowWrap = 'anywhere';
    element.style.fontSize = fontSize + 'px';

    let elementRect = element.getBoundingClientRect();

    // Shrink only if block overflows parent
    while (
      (elementRect.width - parentRect.width > tolerance ||
        elementRect.height - parentRect.height > tolerance) &&
      fontSize > minFontSize
    ) {
      fontSize -= 1;
      element.style.fontSize = fontSize + 'px';
      elementRect = element.getBoundingClientRect();
    }
  }
}
