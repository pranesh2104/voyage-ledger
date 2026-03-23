import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { environment } from '../environment/environment';
import { CustomTitleStrategy } from './core/services/title-strategy.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { apiUrlInterceptor } from './core/interceptors/api-url.interceptor';
import { API_BASE_URL } from './core/tokens/api-base-url.token';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    provideHttpClient(withFetch(), withInterceptors([apiUrlInterceptor, authInterceptor])),
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
  ],
};
