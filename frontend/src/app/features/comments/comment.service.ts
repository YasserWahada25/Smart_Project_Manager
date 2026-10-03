import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Comment } from '../../core/models/comment';
import { Paginated } from '../../core/models/pagination';

/**
 * Comments of a task. The backend enforces the rules: the project manager and members comment
 * (not administrators), only the author edits, the author or the project manager deletes.
 */
@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Oldest first. */
  list(taskId: string, page: number, limit: number): Observable<Paginated<Comment>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<Paginated<Comment>>(`${this.api}/tasks/${taskId}/comments`, { params });
  }

  create(taskId: string, content: string): Observable<Comment> {
    return this.http
      .post<{ comment: Comment }>(`${this.api}/tasks/${taskId}/comments`, { content })
      .pipe(map(({ comment }) => comment));
  }

  update(id: string, content: string): Observable<Comment> {
    return this.http
      .patch<{ comment: Comment }>(`${this.api}/comments/${id}`, { content })
      .pipe(map(({ comment }) => comment));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/comments/${id}`);
  }
}
