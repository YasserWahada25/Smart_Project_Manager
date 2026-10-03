import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DashboardData,
  ProjectDashboardData,
  SearchResults,
} from '../../core/models/dashboard';

/** Dashboards and global search (indicators computed by the backend). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Indicators over the projects the user can see, adapted to their role. */
  get(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.api}/dashboard`);
  }

  forProject(projectId: string): Observable<ProjectDashboardData> {
    return this.http.get<ProjectDashboardData>(`${this.api}/projects/${projectId}/dashboard`);
  }

  /** Projects (name, description) and tasks (title, description); `q`: 2–100 characters. */
  search(q: string, limit: number): Observable<SearchResults> {
    const params = new HttpParams().set('q', q.trim()).set('limit', limit);
    return this.http.get<SearchResults>(`${this.api}/search`, { params });
  }
}
