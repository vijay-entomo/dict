import { Directive, ElementRef, HostListener, Renderer2, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[appHorizontalScroll]',
  standalone: true,
})
export class HorizontalScrollDirective implements AfterViewInit {
  private track!: HTMLElement;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngAfterViewInit() {
    // Find the track container that holds all the cards
    this.track = this.el.nativeElement.querySelector('.scroll_track');
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
   if (!this.track) return;

    const host = this.el.nativeElement;
    const rect = host.getBoundingClientRect();

    // Total distance the user can scroll vertically within this section
    const totalScrollable = rect.height - window.innerHeight;

    // Calculate percentage (0 to 1) of scroll completion
    let progress = -rect.top / totalScrollable;
    progress = Math.max(0, Math.min(1, progress));

    // Calculate how far horizontally the track needs to move
    // Total width of all cards minus the visible width of the viewing area
    const trackWidth = this.track.scrollWidth;
    const visibleWidth = this.track.parentElement?.offsetWidth || window.innerWidth;

    // Add extra padding to the max translate so the last card doesn't hit the absolute edge
    const maxTranslate = trackWidth - visibleWidth + 100;

    if (maxTranslate > 0) {
      // Apply the transformation smoothly
      const translateX = progress * maxTranslate;
      this.renderer.setStyle(this.track, 'transform', `translateX(-${translateX}px)`);
    }
  }
}
