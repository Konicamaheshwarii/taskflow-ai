import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';

/** Hand-written SVG charts: no chart library, so the bundle stays small and the markup stays accessible. */

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

const H = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 34 };
const IH = H - PAD.top - PAD.bottom;

/** A round step so the axis has at most five intervals. */
export function niceStep(v: number): number {
  for (let pow = 1; ; pow *= 10) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * pow;
      if (Number.isInteger(step) && Math.ceil(v / step) <= 5) return step;
    }
  }
}

export function niceMax(v: number): number {
  const step = niceStep(Math.max(v, 1));
  return Math.max(step, Math.ceil(v / step) * step);
}

function ticks(max: number): number[] {
  const step = niceStep(max);
  return Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Every nth x label so they never collide (about one label per 70px). */
function labelEvery(count: number, width: number): number {
  return Math.max(1, Math.ceil(count / Math.max(2, Math.floor(width / 70))));
}

/** The chart's real pixel width, so the viewBox is 1:1 and text keeps its size on every screen. */
function hostWidth() {
  const width = signal(640);
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) width.set(Math.max(280, w));
    });
    ro.observe(el);
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }
  return width;
}

@Component({
  selector: 'app-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="label()">
        @for (t of yTicks(); track t) {
          <line class="grid" [attr.x1]="PAD.left" [attr.x2]="W - PAD.right" [attr.y1]="y(t)" [attr.y2]="y(t)" />
          <text class="axis" [attr.x]="PAD.left - 6" [attr.y]="y(t) + 4" text-anchor="end">{{ fmt(t) }}</text>
        }
        @for (a of areas(); track a.name) {
          <path [attr.d]="a.d" [attr.fill]="a.color" class="area" />
        }
        @for (l of xLabels(); track l.i) {
          <text class="axis" [attr.x]="x(l.i)" [attr.y]="H - 8" text-anchor="middle">{{ l.text }}</text>
        }
        @if (hover() !== null) {
          <line class="cross" [attr.x1]="x(hover()!)" [attr.x2]="x(hover()!)" [attr.y1]="PAD.top" [attr.y2]="PAD.top + IH" />
        }
        @for (l of labels(); track $index; let i = $index) {
          <rect class="hit" [attr.x]="x(i) - step() / 2" [attr.y]="PAD.top" [attr.width]="step()" [attr.height]="IH" (mouseenter)="hover.set(i)" />
        }
      </svg>
      @if (hover() !== null) {
        <div class="tip" [style.left.%]="(x(hover()!) / W) * 100" [class.flip]="hover()! > labels().length / 2">
          <strong>{{ labels()[hover()!] }}</strong>
          @for (s of series(); track s.name) {
            <span><i [style.background]="s.color"></i>{{ s.name }} <b>{{ s.values[hover()!] ?? '-' }}</b></span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './charts.scss',
})
export class AreaChart {
  readonly series = input.required<Series[]>();
  readonly labels = input.required<string[]>();
  readonly label = input('');

  protected readonly width = hostWidth();
  protected get W(): number { return this.width(); }
  protected readonly H = H;
  protected readonly PAD = PAD;
  protected readonly IH = IH;
  protected readonly fmt = fmt;
  protected readonly hover = signal<number | null>(null);

  protected readonly max = computed(() => {
    const n = this.labels().length;
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, this.series().reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
    return niceMax(m);
  });
  protected readonly yTicks = computed(() => ticks(this.max()));
  protected readonly step = computed(() => (this.width() - PAD.left - PAD.right) / Math.max(1, this.labels().length - 1));
  protected readonly xLabels = computed(() => {
    const every = labelEvery(this.labels().length, this.width());
    return this.labels().map((text, i) => ({ i, text })).filter((l) => l.i % every === 0);
  });

  protected x(i: number): number {
    return PAD.left + i * this.step();
  }

  protected y(v: number): number {
    return PAD.top + IH - (v / this.max()) * IH;
  }

  /** Stacked bottom-up in reverse order, so the last series (e.g. Done) sits on the baseline. */
  protected readonly areas = computed(() => {
    const n = this.labels().length;
    const base = new Array(n).fill(0);
    return [...this.series()].reverse().map((s) => {
      const lower = [...base];
      const upper = lower.map((b, i) => b + (s.values[i] ?? 0));
      upper.forEach((v, i) => (base[i] = v));
      const top = upper.map((v, i) => `${this.x(i)},${this.y(v)}`).join(' L');
      const bottom = lower.map((v, i) => `${this.x(i)},${this.y(v)}`).reverse().join(' L');
      return { name: s.name, color: s.color, d: `M${top} L${bottom} Z` };
    });
  });
}

@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="label()">
        @for (t of yTicks(); track t) {
          <line class="grid" [attr.x1]="PAD.left" [attr.x2]="W - PAD.right" [attr.y1]="y(t)" [attr.y2]="y(t)" />
          <text class="axis" [attr.x]="PAD.left - 6" [attr.y]="y(t) + 4" text-anchor="end">{{ fmt(t) }}</text>
        }
        @for (l of xLabels(); track l.i) {
          <text class="axis" [attr.x]="x(l.i)" [attr.y]="H - 8" text-anchor="middle">{{ l.text }}</text>
        }
        @for (p of paths(); track p.name) {
          <path [attr.d]="p.d" [attr.stroke]="p.color" class="line" [class.dashed]="p.dashed" />
          @if (p.end; as e) { <circle [attr.cx]="e.x" [attr.cy]="e.y" r="4" [attr.fill]="p.color" class="dot" /> }
        }
        @if (hover() !== null) {
          <line class="cross" [attr.x1]="x(hover()!)" [attr.x2]="x(hover()!)" [attr.y1]="PAD.top" [attr.y2]="PAD.top + IH" />
        }
        @for (l of labels(); track $index; let i = $index) {
          <rect class="hit" [attr.x]="x(i) - step() / 2" [attr.y]="PAD.top" [attr.width]="step()" [attr.height]="IH" (mouseenter)="hover.set(i)" />
        }
      </svg>
      @if (hover() !== null) {
        <div class="tip" [style.left.%]="(x(hover()!) / W) * 100" [class.flip]="hover()! > labels().length / 2">
          <strong>{{ labels()[hover()!] }}</strong>
          @for (s of series(); track s.name) {
            <span><i [style.background]="s.color"></i>{{ s.name }} <b>{{ s.values[hover()!] ?? '-' }}</b></span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './charts.scss',
})
export class LineChart {
  readonly series = input.required<Series[]>();
  readonly labels = input.required<string[]>();
  readonly label = input('');

  protected readonly width = hostWidth();
  protected get W(): number { return this.width(); }
  protected readonly H = H;
  protected readonly PAD = PAD;
  protected readonly IH = IH;
  protected readonly fmt = fmt;
  protected readonly hover = signal<number | null>(null);

  protected readonly max = computed(() => niceMax(Math.max(0, ...this.series().flatMap((s) => s.values.map((v) => v ?? 0)))));
  protected readonly yTicks = computed(() => ticks(this.max()));
  protected readonly step = computed(() => (this.width() - PAD.left - PAD.right) / Math.max(1, this.labels().length - 1));
  protected readonly xLabels = computed(() => {
    const every = labelEvery(this.labels().length, this.width());
    return this.labels().map((text, i) => ({ i, text })).filter((l) => l.i % every === 0);
  });

  protected x(i: number): number {
    return PAD.left + i * this.step();
  }

  protected y(v: number): number {
    return PAD.top + IH - (v / this.max()) * IH;
  }

  protected readonly paths = computed(() => this.series().map((s) => {
    const pts = s.values.map((v, i) => (v === null ? null : { x: this.x(i), y: this.y(v) })).filter((p): p is { x: number; y: number } => !!p);
    return {
      name: s.name, color: s.color, dashed: !!s.dashed,
      d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '),
      end: s.dashed ? null : pts[pts.length - 1] ?? null,
    };
  }));
}

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="label()">
        @for (t of yTicks(); track t) {
          <line class="grid" [attr.x1]="PAD.left" [attr.x2]="W - PAD.right" [attr.y1]="y(t)" [attr.y2]="y(t)" />
          <text class="axis" [attr.x]="PAD.left - 6" [attr.y]="y(t) + 4" text-anchor="end">{{ fmt(t) }}</text>
        }
        @for (b of bars(); track b.i) {
          <path [attr.d]="b.d" [attr.fill]="color()" class="bar" [class.dim]="hover() !== null && hover() !== b.i" />
          @if (b.value > 0) { <text class="value" [attr.x]="b.cx" [attr.y]="b.top - 5" text-anchor="middle">{{ b.value }}</text> }
          @if (b.i % every() === 0) { <text class="axis" [attr.x]="b.cx" [attr.y]="H - 8" text-anchor="middle">{{ labels()[b.i] }}</text> }
          <rect class="hit" [attr.x]="b.cx - slot() / 2" [attr.y]="PAD.top" [attr.width]="slot()" [attr.height]="IH" (mouseenter)="hover.set(b.i)" />
        }
      </svg>
      @if (hover() !== null) {
        <div class="tip" [style.left.%]="(bars()[hover()!].cx / W) * 100" [class.flip]="hover()! > labels().length / 2">
          <strong>{{ tipPrefix() }}{{ labels()[hover()!] }}</strong>
          <span><i [style.background]="color()"></i>{{ seriesName() }} <b>{{ values()[hover()!] }}</b></span>
        </div>
      }
    </div>
  `,
  styleUrl: './charts.scss',
})
export class BarChart {
  readonly values = input.required<number[]>();
  readonly labels = input.required<string[]>();
  readonly color = input('var(--s1)');
  readonly seriesName = input('');
  readonly tipPrefix = input('');
  readonly label = input('');

  protected readonly width = hostWidth();
  protected get W(): number { return this.width(); }
  protected readonly H = H;
  protected readonly PAD = PAD;
  protected readonly IH = IH;
  protected readonly fmt = fmt;
  protected readonly hover = signal<number | null>(null);

  protected readonly max = computed(() => niceMax(Math.max(0, ...this.values())));
  protected readonly yTicks = computed(() => ticks(this.max()));
  protected readonly every = computed(() => labelEvery(this.values().length, this.width() * 0.9));
  protected readonly slot = computed(() => (this.width() - PAD.left - PAD.right) / Math.max(1, this.values().length));

  protected y(v: number): number {
    return PAD.top + IH - (v / this.max()) * IH;
  }

  /** Bars with a 4px rounded top and a square base on the axis. */
  protected readonly bars = computed(() => this.values().map((value, i) => {
    const w = Math.min(44, this.slot() * 0.6);
    const cx = PAD.left + this.slot() * (i + 0.5);
    const top = this.y(value);
    const bottom = PAD.top + IH;
    const r = Math.min(4, (bottom - top) / 2, w / 2);
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const d = value > 0
      ? `M${x0},${bottom} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x1 - r},${top} Q${x1},${top} ${x1},${top + r} L${x1},${bottom} Z`
      : '';
    return { i, value, cx, top, d };
  }));
}
