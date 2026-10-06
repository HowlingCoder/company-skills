import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  SiApplicationHeaderComponent,
  SiHeaderActionItemComponent,
  SiHeaderActionsDirective,
  SiHeaderBrandDirective,
} from '@siemens/element-ng/application-header';
import { ThemeMode } from './theme/theme-mode';

@Component({
  imports: [
    RouterOutlet,
    SiApplicationHeaderComponent,
    SiHeaderActionItemComponent,
    SiHeaderActionsDirective,
    SiHeaderBrandDirective,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly themeMode = inject(ThemeMode);
}
