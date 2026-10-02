import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';
import { AppTitleStrategy } from './core/routing/app-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Order matters: authInterceptor wraps apiErrorInterceptor, so it receives normalized ApiErrors.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, apiErrorInterceptor])),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideAppInitializer(() => {
      // <mat-icon> uses the "Material Symbols Outlined" font loaded in index.html.
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      // Re-validate a session restored from storage (non-blocking).
      inject(AuthService).refreshOnStartup();
    }),
  ],
};
