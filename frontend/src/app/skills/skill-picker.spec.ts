import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Skill } from '../api/models';
import { SkillPicker } from './skill-picker';

const kubernetes: Skill = { id: 's1', name: 'Kubernetes', alias: 'K8s', description: null };
const kotlin: Skill = { id: 's2', name: 'Kotlin', alias: null, description: null };

// longer than the debounce of the picker
const DEBOUNCE_MS = 250;

describe('SkillPicker', () => {
  let fixture: ComponentFixture<SkillPicker>;
  let input: HTMLInputElement;
  let http: HttpTestingController;
  let selected: Skill[];

  async function render(excludedSkillIds: string[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SkillPicker);
    fixture.componentRef.setInput('inputId', 'picker');
    fixture.componentRef.setInput('excludedSkillIds', excludedSkillIds);
    selected = [];
    fixture.componentInstance.skillSelected.subscribe((skill) => selected.push(skill));
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input');
  }

  /** Types into the picker and answers the catalog request. */
  async function search(term: string, result: Skill[]): Promise<void> {
    input.focus();
    input.value = term;
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
    // the typeahead cancels lookups that a newer input replaced
    const requests = http.match((req) => req.url === '/api/skills').filter((req) => !req.cancelled);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.params.get('q')).toBe(term);
    requests[0].flush(result);
    await fixture.whenStable();
  }

  function options(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('si-typeahead li.dropdown-item'));
  }

  afterEach(() => http.verify());

  it('searches the catalog on the server and shows name and alias', async () => {
    await render();

    await search('k', [kotlin, kubernetes]);

    expect(options().map((option) => option.textContent?.trim())).toEqual([
      'Kotlin',
      'Kubernetes (K8s)',
    ]);
  });

  it('does not offer skills that are excluded', async () => {
    await render(['s1']);

    await search('k', [kotlin, kubernetes]);

    expect(options().map((option) => option.textContent?.trim())).toEqual(['Kotlin']);
  });

  it('emits the chosen skill and clears the input', async () => {
    await render();
    await search('kub', [kubernetes]);

    options()[0].click();
    await fixture.whenStable();

    expect(selected).toEqual([kubernetes]);
    expect(input.value).toBe('');
    // clearing the input may trigger another lookup
    http
      .match((req) => req.url === '/api/skills')
      .filter((req) => !req.cancelled)
      .forEach((req) => req.flush([]));
  });
  describe('with free text', () => {
    let terms: string[];

    async function renderFreeText(): Promise<void> {
      await render();
      fixture.componentRef.setInput('allowFreeText', true);
      terms = [];
      fixture.componentInstance.termEntered.subscribe((term) => terms.push(term));
      await fixture.whenStable();
    }

    async function pressEnter(): Promise<void> {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }

    function flushLookups(): void {
      http
        .match((req) => req.url === '/api/skills')
        .filter((req) => !req.cancelled)
        .forEach((req) => req.flush([]));
    }

    it('submits the typed text on Enter, e.g. a wildcard, and clears the input', async () => {
      await renderFreeText();
      await search('c*', []);

      await pressEnter();

      expect(terms).toEqual(['c*']);
      expect(selected).toEqual([]);
      expect(input.value).toBe('');
      flushLookups();
    });

    it('does not pick the first suggestion on Enter', async () => {
      await renderFreeText();
      await search('k', [kotlin, kubernetes]);

      await pressEnter();

      expect(terms).toEqual(['k']);
      expect(selected).toEqual([]);
      flushLookups();
    });

    it('ignores Enter on an empty input', async () => {
      await renderFreeText();

      await pressEnter();

      expect(terms).toEqual([]);
      flushLookups();
    });
  });

  it('says so when the typed text matches no skill', async () => {
    await render();

    await search('cobol', []);

    expect(fixture.nativeElement.textContent).toContain('No matching skill in the catalog.');
  });

  it('says so when every match is excluded, e.g. already assigned', async () => {
    await render(['s1']);

    await search('kub', [kubernetes]);

    expect(options()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Already assigned.');
    expect(fixture.nativeElement.textContent).not.toContain('No matching skill');
  });

  it('shows no hint while a match is left next to an excluded one', async () => {
    await render(['s1']);

    await search('k', [kotlin, kubernetes]);

    expect(fixture.nativeElement.textContent).not.toContain('Already assigned.');
    expect(fixture.nativeElement.textContent).not.toContain('No matching skill');
  });

  it('shows no hint while there are matches', async () => {
    await render();

    await search('k', [kotlin, kubernetes]);

    expect(fixture.nativeElement.textContent).not.toContain('No matching skill');
  });

  it('shows no hint with free text, where a term like a wildcard needs no match', async () => {
    await render();
    fixture.componentRef.setInput('allowFreeText', true);

    await search('c*', []);

    expect(fixture.nativeElement.textContent).not.toContain('No matching skill');
  });

  it('offers the whole catalog, not only the first matches', async () => {
    await render();
    const catalog: Skill[] = Array.from({ length: 25 }, (_, index) => ({
      id: `c${index}`,
      name: `Skill ${index}`,
      alias: null,
      description: null,
    }));

    await search('skill', catalog);

    expect(options()).toHaveLength(25);
  });

  it('waits for the minimum length before it looks up suggestions', async () => {
    await render();
    fixture.componentRef.setInput('minLength', 1);
    await fixture.whenStable();

    input.focus();
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
    await fixture.whenStable();

    expect(options()).toHaveLength(0);
    http
      .match((req) => req.url === '/api/skills')
      .filter((req) => !req.cancelled)
      .forEach((req) => req.flush([kotlin]));
    await fixture.whenStable();
    expect(options()).toHaveLength(0);
  });

  it('does not submit free text unless it is allowed', async () => {
    await render();
    const terms: string[] = [];
    fixture.componentInstance.termEntered.subscribe((term) => terms.push(term));
    await search('zzz', []);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve));

    expect(terms).toEqual([]);
    expect(input.value).toBe('zzz');
  });
});
