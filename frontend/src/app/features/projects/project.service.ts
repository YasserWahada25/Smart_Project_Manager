import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Paginated } from '../../core/models/pagination';
import { Project, ProjectInput, ProjectStatus } from '../../core/models/project';

/** Filters of GET /projects (page is 1-based, like the backend). */
export interface ProjectQuery {
  page: number;
  limit: number;
  status?: ProjectStatus;
  search?: string;
}

/**
 * Projects and their team (`/projects` endpoints). The backend decides what each user can
 * see (admin: all, manager: own projects, developer: projects they belong to) and modify
 * (only the project manager).
 */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/projects`;

  list(query: ProjectQuery): Observable<Paginated<Project>> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    if (query.status) params = params.set('status', query.status);
    const search = query.search?.trim();
    if (search) params = params.set('search', search);
    return this.http.get<Paginated<Project>>(this.url, { params });
  }

  get(id: string): Observable<Project> {
    return this.http.get<{ project: Project }>(`${this.url}/${id}`).pipe(map(unwrap));
  }

  /** The new project starts in PLANNING; an empty deadline is simply not sent. */
  create(input: ProjectInput): Observable<Project> {
    const { deadline, ...required } = input;
    const body = deadline ? input : required;
    return this.http.post<{ project: Project }>(this.url, body).pipe(map(unwrap));
  }

  update(id: string, changes: Partial<ProjectInput>): Observable<Project> {
    return this.http.patch<{ project: Project }>(`${this.url}/${id}`, changes).pipe(map(unwrap));
  }

  /** Allowed even on an archived project (it is the way to un-archive it). */
  setStatus(id: string, status: ProjectStatus): Observable<Project> {
    return this.http.patch<{ project: Project }>(`${this.url}/${id}`, { status }).pipe(map(unwrap));
  }

  /** Only an empty project can be deleted (409 when it has sprints or tasks). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  addMember(projectId: string, userId: string): Observable<Project> {
    return this.http
      .post<{ project: Project }>(`${this.url}/${projectId}/members`, { userId })
      .pipe(map(unwrap));
  }

  /** 409 when the member still has unfinished tasks assigned in the project. */
  removeMember(projectId: string, userId: string): Observable<Project> {
    return this.http
      .delete<{ project: Project }>(`${this.url}/${projectId}/members/${userId}`)
      .pipe(map(unwrap));
  }
}

function unwrap({ project }: { project: Project }): Project {
  return project;
}
