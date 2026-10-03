import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  LinearScale,
  Tooltip,
} from 'chart.js';

// Only the pieces used by the dashboards are bundled (Chart.js is tree-shakable): bar charts
// with a hover tooltip.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

/**
 * Chart.js chart on a canvas, re-drawn when its configuration changes. The canvas is an image
 * for assistive technologies (`label`); pages show the same values as text next to it.
 */
@Component({
  selector: 'app-chart',
  template: `
    <div class="chart" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="label()"></canvas>
    </div>
  `,
  styles: `
    .chart {
      position: relative;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartView {
  readonly config = input.required<ChartConfiguration>();
  readonly label = input.required<string>();
  readonly height = input(220);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const config = this.config();
      const canvas = this.canvas().nativeElement;
      untracked(() => this.draw(canvas, config));
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private draw(canvas: HTMLCanvasElement, config: ChartConfiguration): void {
    this.chart?.destroy();
    this.chart = undefined;
    // No 2D context (e.g. canvas not supported): the text values remain displayed.
    const context = canvas.getContext('2d');
    if (!context) return;
    this.chart = new Chart(context, {
      ...config,
      options: { responsive: true, maintainAspectRatio: false, ...config.options },
    });
  }
}
