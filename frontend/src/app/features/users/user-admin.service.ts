import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Paginated } from '../../core/models/pagination';
import { Role, User } from '../../core/models/user';

/** Filters of GET /users (page is 1-based, like the backend). */
export interface UserQuery {
  page: number;
  limit: number;
  role?: Role;
  isActive?: boolean;
  search?: string;
}

/** User administration (`/users` endpoints, ADMIN only — enforced by the backend). */
@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/users`;

  list(query: UserQuery): Observable<Paginated<User>> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    if (query.role) params = params.set('role', query.role);
    if (query.isActive !== undefined) params = params.set('isActive', query.isActive);
    const search = query.search?.trim();
    if (search) params = params.set('search', search);
    return this.http.get<Paginated<User>>(this.url, { params });
  }

  /** Deactivation signs the user out immediately and blocks any new login. */
  setActive(id: string, isActive: boolean): Observable<User> {
    return this.http
      .patch<{ user: User }>(`${this.url}/${id}/status`, { isActive })
      .pipe(map(({ user }) => user));
  }

  setRole(id: string, role: Role): Observable<User> {
    return this.http
      .patch<{ user: User }>(`${this.url}/${id}/role`, { role })
      .pipe(map(({ user }) => user));
  }
}
