import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { SearchResults } from '../../../core/models/dashboard';
import { DashboardService } from '../../dashboard/dashboard.service';
import { SearchPage } from './search-page';

describe('SearchPage', () => {
  let fixture: ComponentFixture<SearchPage>;
  let search: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const results: SearchResults = {
    query: 'pay',
    projects: {
      total: 1,
      items: [{ id: 'p1', name: 'Payment platform', description: 'Stripe', status: 'ACTIVE' }],
    },
    tasks: {
      total: 12,
      items: [
        {
          id: 't1',
          title: 'Stripe payment integration',
          status: 'TODO',
          priority: 'HIGH',
          type: 'FEATURE',
          project: { id: 'p1', name: 'Payment platform' },
          assignee: null,
        },
      ],
    },
  };

  async function render(q?: string) {
    search = vi.fn(() => of(results));
    TestBed.configureTestingModule({
      imports: [SearchPage],
      providers: [provideRouter([]), { provide: DashboardService, useValue: { search } }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SearchPage);
    if (q !== undefined) fixture.componentRef.setInput('q', q);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent?.replace(/\s+/g, ' ') ?? '';

  it('searches the query of the URL and shows projects and tasks', async () => {
    await render('pay');

    expect(search).toHaveBeenCalledWith('pay', 10);
    expect(element().querySelector('input')?.value).toBe('pay');
    expect(element().querySelector('a[href="/projects/p1"]')?.textContent).toContain(
      'Payment platform',
    );
    expect(element().querySelector('a[href="/projects/p1/tasks/t1"]')?.textContent).toContain(
      'Stripe payment integration',
    );
    expect(text()).toContain('Unassigned');
    expect(text()).toContain('1 of 12 shown');
  });

  it('does not search below two characters', async () => {
    await render('p');

    expect(search).not.toHaveBeenCalled();
    expect(element().querySelector('h2')).toBeNull();
  });

  it('puts what is typed in the URL (debounced)', async () => {
    await render();

    const input = element().querySelector('input')!;
    input.value = ' stripe ';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(navigate).toHaveBeenCalledWith(['/search'], {
      queryParams: { q: 'stripe' },
      replaceUrl: true,
    });
  });

  it('shows the error with a retry button', async () => {
    search = vi.fn();
    TestBed.configureTestingModule({
      imports: [SearchPage],
      providers: [provideRouter([]), { provide: DashboardService, useValue: { search } }],
    });
    search
      .mockReturnValueOnce(
        throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.')),
      )
      .mockReturnValue(of(results));
    fixture = TestBed.createComponent(SearchPage);
    fixture.componentRef.setInput('q', 'pay');
    await fixture.whenStable();
    expect(text()).toContain('Cannot reach the server.');

    element().querySelector<HTMLButtonElement>('app-error-state button')!.click();
    await fixture.whenStable();

    expect(text()).toContain('Payment platform');
  });
});
