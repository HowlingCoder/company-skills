import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  SiApplicationHeaderComponent,
  SiHeaderActionItemComponent,
  SiHeaderActionsDirective,
  SiHeaderBrandDirective,
  SiHeaderLogoDirective,
} from '@siemens/element-ng/application-header';
import {
  SiNavbarVerticalNextComponent,
  SiNavbarVerticalNextItemComponent,
  SiNavbarVerticalNextItemsComponent,
} from '@siemens/element-ng/navbar-vertical-next';
import { ThemeMode } from './theme/theme-mode';

@Component({
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SiApplicationHeaderComponent,
    SiHeaderActionItemComponent,
    SiHeaderActionsDirective,
    SiHeaderBrandDirective,
    SiHeaderLogoDirective,
    SiNavbarVerticalNextComponent,
    SiNavbarVerticalNextItemComponent,
    SiNavbarVerticalNextItemsComponent,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly themeMode = inject(ThemeMode);

  // the employee filters will live in the query params, so they must not affect the active state
  protected readonly activeOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  } as const;
}
