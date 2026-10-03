import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Paginated } from '../../core/models/pagination';
import { Developer } from '../../core/models/project';

export interface DeveloperQuery {
  page: number;
  limit: number;
  /** Contains, on first name, last name or email. */
  search?: string;
  /** Exact skill name, case-insensitive (`node.js` matches `Node.js`, `node` does not). */
  skill?: string;
}

/** Developer directory (GET /developers, PROJECT_MANAGER and ADMIN): active developers only. */
@Injectable({ providedIn: 'root' })
export class DeveloperService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/developers`;

  search(query: DeveloperQuery): Observable<Paginated<Developer>> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    const search = query.search?.trim();
    if (search) params = params.set('search', search);
    const skill = query.skill?.trim();
    if (skill) params = params.set('skill', skill);
    return this.http.get<Paginated<Developer>>(this.url, { params });
  }
}
