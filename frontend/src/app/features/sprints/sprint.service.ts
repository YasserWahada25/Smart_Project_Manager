import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Paginated } from '../../core/models/pagination';
import { Sprint, SprintInput, SprintStatus } from '../../core/models/sprint';

/** A project has few sprints: they are loaded in one page of the maximum size. */
const MAX_SPRINTS = 100;

/** Sprints of a project (only its manager modifies them — enforced by the backend). */
@Injectable({ providedIn: 'root' })
export class SprintService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Sprints of the project in chronological order, with their statistics. */
  list(projectId: string): Observable<Sprint[]> {
    const params = new HttpParams().set('page', 1).set('limit', MAX_SPRINTS);
    return this.http
      .get<Paginated<Sprint>>(`${this.api}/projects/${projectId}/sprints`, { params })
      .pipe(map((page) => page.data));
  }

  create(projectId: string, input: SprintInput): Observable<Sprint> {
    return this.http
      .post<{ sprint: Sprint }>(`${this.api}/projects/${projectId}/sprints`, input)
      .pipe(map(({ sprint }) => sprint));
  }

  /** 409 once the sprint is COMPLETED or CANCELLED. */
  update(id: string, input: SprintInput): Observable<Sprint> {
    return this.http
      .patch<{ sprint: Sprint }>(`${this.api}/sprints/${id}`, input)
      .pipe(map(({ sprint }) => sprint));
  }

  /** 409 for a transition not allowed, or a second ACTIVE sprint in the project. */
  setStatus(id: string, status: SprintStatus): Observable<Sprint> {
    return this.http
      .patch<{ sprint: Sprint }>(`${this.api}/sprints/${id}/status`, { status })
      .pipe(map(({ sprint }) => sprint));
  }

  /** Only PLANNED sprints can be deleted; their tasks go back to the backlog. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/sprints/${id}`);
  }
}
