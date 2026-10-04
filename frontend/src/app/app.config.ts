import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideSiDatatableConfig } from '@siemens/element-ng/datatable';
import { routes } from './app.routes';
import { ThemeMode } from './theme/theme-mode';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    provideSiDatatableConfig(),
    provideAppInitializer(() => inject(ThemeMode).init()),
  ],
};
