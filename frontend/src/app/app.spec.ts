import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application name in the header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Company Skill Management');
  });

  it('switches between light and dark mode with the header button', async () => {
    localStorage.clear();
    document.documentElement.classList.remove('app--dark');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector<HTMLButtonElement>('button[si-header-action-item]')!;
    expect(toggle.textContent).toContain('Switch to dark mode');

    toggle.click();
    await fixture.whenStable();

    expect(document.documentElement.classList).toContain('app--dark');
    expect(toggle.textContent).toContain('Switch to light mode');
    document.documentElement.classList.remove('app--dark');
    localStorage.clear();
  });
});
