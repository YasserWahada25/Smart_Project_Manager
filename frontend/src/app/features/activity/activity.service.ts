import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Activity, ActivityType } from '../../core/models/activity';
import { Paginated } from '../../core/models/pagination';

/** Activity history (read-only, recorded by the backend), newest first. */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  forProject(
    projectId: string,
    page: number,
    limit: number,
    type?: ActivityType,
  ): Observable<Paginated<Activity>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (type) params = params.set('type', type);
    return this.http.get<Paginated<Activity>>(`${this.api}/projects/${projectId}/activities`, {
      params,
    });
  }

  forTask(taskId: string, page: number, limit: number): Observable<Paginated<Activity>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<Paginated<Activity>>(`${this.api}/tasks/${taskId}/activities`, { params });
  }
}
