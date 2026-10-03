import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { Paginated } from '../../../core/models/pagination';
import { Project } from '../../../core/models/project';
import { Role } from '../../../core/models/user';
import { fakeAuthService, testMember, testProject, testUser } from '../../../testing/test-data';
import { ProjectService } from '../project.service';
import { ProjectList } from './project-list';

describe('ProjectList', () => {
  let fixture: ComponentFixture<ProjectList>;
  let loader: HarnessLoader;
  let list: ReturnType<typeof vi.fn>;

  const page = (data: Project[]): Paginated<Project> => ({
    data,
    pagination: { page: 1, limit: 12, total: data.length, totalPages: 1 },
  });
  const projects = [
    testProject({
      technologies: ['Angular', 'Node.js', 'MongoDB', 'Docker', 'Redis', 'Stripe'],
      members: [testMember()],
    }),
    testProject({
      id: 'p2',
      name: 'Mobile app',
      status: 'ACTIVE',
      description: '',
      deadline: undefined,
      technologies: [],
    }),
  ];

  async function render(
    role: Role = 'PROJECT_MANAGER',
    fetch: () => Observable<Paginated<Project>> = () => of(page(projects)),
  ) {
    list = vi.fn(fetch);
    TestBed.configureTestingModule({
      imports: [ProjectList],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: { list } },
        { provide: AuthService, useValue: fakeAuthService(testUser({ role })) },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(ProjectList);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const cards = () => [...element().querySelectorAll<HTMLAnchorElement>('a.card-link')];

  async function search(value: string) {
    const input = element().querySelector<HTMLInputElement>('input[formControlName="search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();
  }

  it('shows the projects as cards linking to their page', async () => {
    await render();

    expect(list).toHaveBeenCalledWith({ page: 1, limit: 12, status: undefined, search: '' });
    expect(cards().map((card) => card.getAttribute('href'))).toEqual([
      '/projects/p1',
      '/projects/p2',
    ]);
    const first = cards()[0].textContent ?? '';
    expect(first).toContain('E-commerce platform');
    expect(first).toContain('Manager: Sara Manager');
    expect(first).toContain('Planning');
    expect(first).toContain('Oct 1, 2026');
    expect(first).toContain('Jan 31, 2027');
    expect(first).toContain('Docker');
    expect(first).not.toContain('Redis');
    expect(first).toContain('+2');
    expect(first).toContain('1 member');

    const second = cards()[1].textContent ?? '';
    expect(second).toContain('Active');
    expect(second).toContain('0 members');
    expect(second).not.toContain('→');
  });

  it('offers "New project" to project managers only, with a subtitle per role', async () => {
    await render('PROJECT_MANAGER');
    expect(element().querySelector('a[href="/projects/new"]')?.textContent).toContain(
      'New project',
    );
    expect(text()).toContain('The projects you manage.');

    TestBed.resetTestingModule();
    await render('DEVELOPER');
    expect(element().querySelector('a[href="/projects/new"]')).toBeNull();
    expect(text()).toContain('The projects you are a member of.');

    TestBed.resetTestingModule();
    await render('ADMIN');
    expect(element().querySelector('a[href="/projects/new"]')).toBeNull();
    expect(text()).toContain('All the projects of the platform.');
  });

  it('explains an empty list according to the role and the filters', async () => {
    await render('DEVELOPER', () => of(page([])));
    expect(text()).toContain('You are not a member of any project yet.');

    await search('zzz');
    expect(text()).toContain('No project matches these filters.');
  });

  it('filters by name (debounced) and by status, from the first page', async () => {
    await render();

    await search('shop');
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'shop', page: 1 }));

    const status = await loader.getHarness(MatSelectHarness);
    await status.open();
    await status.clickOptions({ text: 'Active' });
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'shop', status: 'ACTIVE', page: 1 }),
    );
  });

  it('shows the error with a retry button', async () => {
    let fail = true;
    await render('PROJECT_MANAGER', () =>
      fail
        ? throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'))
        : of(page(projects)),
    );
    expect(text()).toContain('Cannot reach the server.');

    fail = false;
    element().querySelector<HTMLButtonElement>('app-error-state button')!.click();
    await fixture.whenStable();

    expect(cards()).toHaveLength(2);
  });
});
