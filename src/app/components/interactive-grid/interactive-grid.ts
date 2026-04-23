import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  PLATFORM_ID,
  Inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface GridBlock {
  x: number;
  y: number;
  color: string;
  alpha: number;
  phase: 'idle' | 'in' | 'delay' | 'out';
  timer: number;
}

@Component({
  selector: 'app-interactive-grid',
  standalone: true,
  imports: [],
  templateUrl: './interactive-grid.html',
  styleUrl: './interactive-grid.scss',
})
export class InteractiveGrid implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  gridBackground = input<string>('transparent');
  gridSizeDesktop = input<number>(32);
  gridSizeMobile = input<number>(12);
  gridBorderSize = input<number>(0);
  gridBorderColor = input<string>('transparent');

  private ctx!: CanvasRenderingContext2D | null;
  private animationFrameId: number = 0;
  private resizeListener!: () => void;
  private mouseMoveListener!: (e: MouseEvent) => void;
  private prefersReducedMotionListener!: (e: MediaQueryListEvent) => void;
  private themeObserver!: MutationObserver;

  private cols = 0;
  private rows = 0;
  private squareSize = 0;
  private blocks: GridBlock[] = [];
  private trailQueue: GridBlock[] = [];
  private lastHovered: number | null = null;
  private colorPointer = 0;
  private gridColors: string[] = [];
  private readonly opacities = [0.15, 0.12, 0.1, 0.07, 0.05, 0.03];
  private isBrowser: boolean;
  private lastFrameTime = 0;

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) return;

    this.ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!this.ctx) return;

    this.ngZone.runOutsideAngular(() => {
      this.resolveThemeColors();
      this.setupObservers();
      this.setupGrid();
      this.animationFrameId = requestAnimationFrame(this.draw);
      this.attachEventListeners(prefersReducedMotion);
    });
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    cancelAnimationFrame(this.animationFrameId);
    if (this.themeObserver) this.themeObserver.disconnect();
    if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
    if (this.mouseMoveListener) document.removeEventListener('mousemove', this.mouseMoveListener);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (this.prefersReducedMotionListener) {
      prefersReducedMotion.removeEventListener('change', this.prefersReducedMotionListener);
    }
  }

  private debounce(func: Function, wait: number) {
    let timeout: any;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  private hexToRgb(hex: string): [number, number, number] {
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    const num = parseInt(h, 16);
    return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
  }

  private resolveThemeColors = () => {
    // 1. Get the value of the custom property --theme
    let themeVal =
      getComputedStyle(document.body).getPropertyValue('--theme').trim() ||
      getComputedStyle(document.documentElement).getPropertyValue('--theme').trim();

    if (!themeVal) {
      // Fallback: If --theme is empty, try to get --_theme---text directly
      themeVal =
        getComputedStyle(document.body).getPropertyValue('--_theme---text').trim() ||
        getComputedStyle(document.documentElement).getPropertyValue('--_theme---text').trim() ||
        '#000000';
    }

    // 2. Use a temporary element to let the browser normalize the color string to rgb(r, g, b)
    const tempEl = document.createElement('div');
    tempEl.style.color = themeVal;
    document.body.appendChild(tempEl);
    const resolvedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);

    // 3. Extract R, G, B from the resolved color string e.g., "rgb(28, 229, 133)"
    const match = resolvedColor.match(/\d+/g);
    if (match && match.length >= 3) {
      const [r, g, b] = match.map(Number);
      this.gridColors = this.opacities.map((a) => `rgba(${r},${g},${b},${a})`);
    } else {
      // Emergency fallback to black transitions
      this.gridColors = this.opacities.map((a) => `rgba(0,0,0,${a})`);
    }
  };

  private setupObservers() {
    // Faster debounce for more reactive color updates
    this.themeObserver = new MutationObserver(this.debounce(this.resolveThemeColors, 50));
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
  }

  private setupGrid = () => {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    this.cols = window.innerWidth < 768 ? this.gridSizeMobile() : this.gridSizeDesktop();
    this.squareSize = canvas.width / this.cols;
    this.rows = Math.ceil(canvas.height / this.squareSize);

    this.blocks = [];
    this.trailQueue = [];
    this.lastHovered = null;
    this.colorPointer = 0;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.blocks.push({
          x: x * this.squareSize,
          y: y * this.squareSize,
          color: '#fff',
          alpha: 0,
          phase: 'idle',
          timer: 0,
        });
      }
    }
  };

  private draw = (timestamp: number) => {
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    const dt = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    const borderSize = this.gridBorderSize();
    const borderColor = this.gridBorderColor();

    this.blocks.forEach((b) => {
      // 1. Process custom animation timings
      if (b.phase !== 'idle') {
        b.timer += dt;

        if (b.phase === 'in') {
          b.alpha = Math.min(1, b.timer / 100); // 100ms fade in
          if (b.timer >= 100) {
            b.phase = 'delay';
            b.timer = 0;
          }
        } else if (b.phase === 'delay') {
          if (b.timer >= 500) {
            b.phase = 'out';
            b.timer = 0;
          } // 500ms hold
        } else if (b.phase === 'out') {
          b.alpha = Math.max(0, 1 - b.timer / 2000); // 2000ms fade out
          if (b.timer >= 2000) {
            b.phase = 'idle';
            b.alpha = 0;
          }
        }
      }

      // 2. Render the block
      if (this.ctx) {
        if (b.alpha > 0) {
          this.ctx.fillStyle = b.color;
          this.ctx.globalAlpha = b.alpha;
          this.ctx.fillRect(b.x, b.y, this.squareSize, this.squareSize);
        }

        // Draw grid lines
        this.ctx.globalAlpha = 1;
        if (borderSize > 0) {
          this.ctx.lineWidth = borderSize;
          this.ctx.strokeStyle = borderColor;
          this.ctx.strokeRect(b.x, b.y, this.squareSize, this.squareSize);
        }
      }
    });

    this.animationFrameId = requestAnimationFrame(this.draw);
  };

  private supportsTouch(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 1;
  }

  private attachEventListeners(prefersReducedMotion: MediaQueryList) {
    this.resizeListener = this.debounce(this.setupGrid, 200);
    window.addEventListener('resize', this.resizeListener);

    if (!this.supportsTouch()) {
      this.mouseMoveListener = (e: MouseEvent) => {
        const canvas = this.canvasRef.nativeElement;
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX,
          my = e.clientY;

        if (mx < r.left || mx > r.right || my < r.top || my > r.bottom) return;

        const xIdx = Math.floor((mx - r.left) / this.squareSize);
        const yIdx = Math.floor((my - r.top) / this.squareSize);
        const idx = yIdx * this.cols + xIdx;

        if (idx !== this.lastHovered && this.blocks[idx]) {
          const b = this.blocks[idx];

          // Trigger custom animation sequence
          b.color = this.gridColors[this.colorPointer];
          this.colorPointer = (this.colorPointer + 1) % this.gridColors.length;
          b.phase = 'in';
          b.timer = 0;

          this.trailQueue.push(b);
          if (this.trailQueue.length > this.gridColors.length) {
            const old = this.trailQueue.shift();
            if (old) {
              old.phase = 'idle';
              old.alpha = 0;
            }
          }
          this.lastHovered = idx;
        }
      };
      document.addEventListener('mousemove', this.mouseMoveListener);
    }

    this.prefersReducedMotionListener = (e: MediaQueryListEvent) => {
      if (e.matches) {
        cancelAnimationFrame(this.animationFrameId);
        this.ctx?.clearRect(
          0,
          0,
          this.canvasRef.nativeElement.width,
          this.canvasRef.nativeElement.height,
        );
      } else {
        this.setupGrid();
        this.lastFrameTime = 0;
        this.animationFrameId = requestAnimationFrame(this.draw);
      }
    };
    prefersReducedMotion.addEventListener('change', this.prefersReducedMotionListener);
  }
}
