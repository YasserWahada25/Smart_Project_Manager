import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { of } from 'rxjs';

import { ChartView } from '../../shared/components/chart/chart';
import { testRisk } from '../../testing/test-data';
import { AiRiskService } from '../ai-risk/ai-risk.service';
import { ActiveSprintCard } from './active-sprint-card/active-sprint-card';
import { testActiveSprint, testIndicators, testWorkloadRow } from '../../testing/dashboard-data';
import { TaskCharts } from './task-charts/task-charts';
import { WorkloadTable } from './workload-table/workload-table';

// jsdom has no canvas: the charts are not drawn, their text values are still displayed.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('TaskCharts', () => {
  it('shows tasks by status and by priority as single-hue bars, with the values as text', async () => {
    const fixture = TestBed.createComponent(TaskCharts);
    fixture.componentRef.setInput('indicators', testIndicators());
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const lists = [...element.querySelectorAll('ul.values')].map((list) =>
      list.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(lists[0]).toBe('To do 2 In progress 1 Code review 0 Testing 0 Done 2 Blocked 1');
    expect(lists[1]).toBe('Low 1 Medium 2 High 2 Critical 1');
    expect(element.querySelector('canvas')?.getAttribute('role')).toBe('img');

    const charts = fixture.debugElement
      .queryAll(By.directive(ChartView))
      .map((node) => (node.componentInstance as ChartView).config() as ChartConfiguration<'bar'>);
    expect(charts).toHaveLength(2);
    for (const chart of charts) {
      expect(chart.type).toBe('bar');
      expect(chart.options?.indexAxis).toBe('y');
      expect(chart.data.datasets).toHaveLength(1);
      expect(chart.data.datasets[0].maxBarThickness).toBeLessThanOrEqual(24);
    }
    expect(charts[0].data.datasets[0].data).toEqual([2, 1, 0, 0, 2, 1]);
  });

  it('explains that there is nothing to chart yet', async () => {
    const fixture = TestBed.createComponent(TaskCharts);
    fixture.componentRef.setInput('indicators', testIndicators({ total: 0 }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('No task yet');
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
  });
});

describe('WorkloadTable', () => {
  it('lists the open work per developer, bars relative to the heaviest', async () => {
    const fixture = TestBed.createComponent(WorkloadTable);
    fixture.componentRef.setInput('rows', [
      testWorkloadRow(),
      testWorkloadRow({
        user: { id: 'd2', firstName: 'Lina', lastName: 'Ben', email: 'l@b.c' },
        openPoints: 4,
        blockedTasks: 0,
      }),
    ]);
    await fixture.whenStable();
    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')];

    const cells = (row: Element) =>
      [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim());
    expect(cells(rows[0])).toEqual(['Youssef Alami', '8', '3', '1', '1']);
    expect(rows[0].querySelector<HTMLElement>('.bar')?.style.width).toBe('100%');
    expect(rows[1].querySelector<HTMLElement>('.bar')?.style.width).toBe('50%');
    expect(rows[0].querySelector('.alert')?.textContent).toBe('1');
  });

  it('says when nobody has open work', async () => {
    const fixture = TestBed.createComponent(WorkloadTable);
    fixture.componentRef.setInput('rows', []);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('No open task assigned.');
  });
});

describe('ActiveSprintCard', () => {
  it('shows the progress, the days left and the AI delay risk, and links to the sprint board', async () => {
    const risk = vi.fn(() => of(testRisk()));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AiRiskService, useValue: { risk } }],
    });
    const fixture = TestBed.createComponent(ActiveSprintCard);
    fixture.componentRef.setInput('sprint', testActiveSprint({ daysRemaining: -2 }));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent?.replace(/\s+/g, ' ');

    expect(element.querySelector('a')?.getAttribute('href')).toBe('/projects/p1/board?sprint=s1');
    expect(text).toContain('E-commerce platform');
    expect(text).toContain('5 / 10 points (50%)');
    expect(text).toContain('1 / 3 tasks done');
    expect(text).toContain('1 blocked');
    expect(text).toContain('2 days late');
    expect(element.querySelector('.days')?.classList).toContain('alert');
    expect(risk).toHaveBeenCalledWith('s1');
    expect(text).toContain('Delay risk (AI): High (82%)');
  });
});
