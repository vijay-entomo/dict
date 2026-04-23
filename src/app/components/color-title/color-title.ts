import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-color-text',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './color-title.html',
  styleUrl: './color-title.scss',
})
export class ColorTextComponent {
  words = 'navigate next'.split(' ');

  colors = [
    'oklch(75% 0.183 55.934)',
    'oklch(82.8% 0.189 84.429)',
    'oklch(90.5% 0.182 98.111)',
    'oklch(84.1% 0.238 128.85)',
    'oklch(79.2% 0.209 151.711)',
    'oklch(76.5% 0.177 163.223)',
    'oklch(77.7% 0.152 181.912)',
    'oklch(78.9% 0.154 211.53)',
    'oklch(74.6% 0.16 232.661)',
    'oklch(70.7% 0.165 254.624)',
    'oklch(67.3% 0.182 276.935)',
    'oklch(70.2% 0.183 293.541)',
    'oklch(71.4% 0.203 305.504)',
    'oklch(74% 0.238 322.16)',
    'oklch(71.8% 0.202 349.761)',
    'oklch(71.2% 0.194 13.428)',
  ];

  fadeDelay = 1500;

  timeouts = new WeakMap<HTMLElement, any>();

  randomColor() {
    return this.colors[Math.floor(Math.random() * this.colors.length)];
  }

  enter(event: MouseEvent) {
    const el = event.target as HTMLElement;

    // 1. GUARD: If it's already animating, don't do anything
    if (el.classList.contains('animate__wobble')) {
      return;
    }

    /* cancel previous fade timeout if any */
    const existing = this.timeouts.get(el);
    if (existing) clearTimeout(existing);

    /* apply color */
    el.style.setProperty('--c', this.randomColor());
    el.classList.add('active');

    /* start wobble */
    el.classList.add('animate__animated', 'animate__wobble');

    /* cleanup animation class ONLY when the animation actually finishes */
    const handler = () => {
      el.classList.remove('animate__animated', 'animate__wobble');

      /* 2. Start the fade-out timer ONLY after the animation is done */
      const timeout = setTimeout(() => {
        el.classList.remove('active');
        el.style.removeProperty('--c');
        this.timeouts.delete(el);
      }, this.fadeDelay);

      this.timeouts.set(el, timeout);
    };

    el.addEventListener('animationend', handler, { once: true });
  }
}
