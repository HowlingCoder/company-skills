import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalRef } from '@siemens/element-ng/modal';
import { SiToastNotificationService } from '@siemens/element-ng/toast-notification';
import { Subject } from 'rxjs';
import { ImportReport } from '../api/models';
import { EMPLOYEES_IMPORTED, ImportDialog } from './import-dialog';

function report(partial: Partial<ImportReport>): ImportReport {
  return { imported_count: 0, failed_count: 0, imported: [], errors: [], ...partial };
}

describe('ImportDialog', () => {
  let fixture: ComponentFixture<ImportDialog>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let modalRef: { hide: ReturnType<typeof vi.fn>; message: Subject<string | undefined> };
  let messages: (string | undefined)[];
  let queueToast: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    modalRef = { hide: vi.fn(), message: new Subject() };
    messages = [];
    modalRef.message.subscribe((message) => messages.push(message));
    queueToast = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModalRef, useValue: modalRef },
        { provide: SiToastNotificationService, useValue: { queueToastNotification: queueToast } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImportDialog);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  /** Picks a CSV file in the uploader and presses its upload button. */
  async function upload(): Promise<void> {
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    const file = new File(['Lastname,Firstname,E-Mail,Age\n'], 'employees.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const uploadButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Upload',
    );
    uploadButton!.click();
    await fixture.whenStable();
  }

  async function respond(body: ImportReport): Promise<void> {
    http.expectOne('/api/employees/import').flush(body);
    await fixture.whenStable();
  }

  it('sends the chosen file as the multipart field "file"', async () => {
    await upload();

    const req = http.expectOne('/api/employees/import');
    expect(req.request.method).toBe('POST');
    const sent = (req.request.body as FormData).get('file') as File;
    expect(sent.name).toBe('employees.csv');
    req.flush(report({}));
  });

  it('closes with a success toast when every row was imported', async () => {
    await upload();
    await respond(report({ imported_count: 12 }));

    expect(queueToast).toHaveBeenCalledWith(
      'success',
      'Employees imported',
      '12 employees imported.',
    );
    expect(messages).toEqual([EMPLOYEES_IMPORTED]);
    expect(modalRef.hide).toHaveBeenCalled();
  });

  it('stays open and lists every failed row after a partial import', async () => {
    await upload();
    await respond(
      report({
        imported_count: 10,
        failed_count: 2,
        errors: [
          { line: 4, message: 'age must be a whole number between 1 and 150' },
          { line: 7, message: 'email is not a valid email address' },
        ],
      }),
    );

    const rows = Array.from(element.querySelectorAll('li')).map((row) => row.textContent?.trim());
    expect(rows).toEqual([
      'Line 4: age must be a whole number between 1 and 150',
      'Line 7: email is not a valid email address',
    ]);
    expect(queueToast).toHaveBeenCalledWith(
      'warning',
      'Import incomplete',
      '10 imported, 2 failed.',
    );
    // the imported rows must show up in the table although the dialog stays open
    expect(messages).toEqual([EMPLOYEES_IMPORTED]);
    expect(modalRef.hide).not.toHaveBeenCalled();
  });

  it('states how many rows of a partial import were imported', async () => {
    await upload();
    await respond(
      report({
        imported_count: 1,
        failed_count: 2,
        errors: [
          { line: 3, message: 'age must be a whole number between 1 and 150' },
          { line: 4, message: 'email is not a valid email address' },
        ],
      }),
    );

    expect(element.querySelector('si-inline-notification')?.textContent).toContain(
      '1 of 3 rows imported',
    );
  });

  it('shows the reason from the backend when the file is rejected', async () => {
    await upload();
    http
      .expectOne('/api/employees/import')
      .flush(
        { detail: 'Missing required column: email' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    const notification = element.querySelector('si-inline-notification');
    expect(notification?.textContent).toContain('File could not be imported');
    expect(notification?.textContent).toContain('Missing required column: email');
    expect(queueToast).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
    expect(modalRef.hide).not.toHaveBeenCalled();
  });

  it('shows a generic message when the server fails', async () => {
    await upload();
    http
      .expectOne('/api/employees/import')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('si-inline-notification')?.textContent).toContain(
      'The server did not answer as expected',
    );
    expect(messages).toEqual([]);
  });

  function footerButton(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.modal-footer button')!;
  }

  it('closes without an upload on cancel', () => {
    expect(footerButton().textContent?.trim()).toBe('Cancel');

    footerButton().click();

    http.expectNone('/api/employees/import');
    expect(modalRef.hide).toHaveBeenCalledWith();
    expect(messages).toEqual([]);
  });

  it('offers "Close" instead of "Cancel" once rows were imported', async () => {
    await upload();
    await respond(
      report({ imported_count: 1, failed_count: 1, errors: [{ line: 3, message: 'age' }] }),
    );

    expect(footerButton().textContent?.trim()).toBe('Close');
  });

  it('tells the user when the file has a header but no employees', async () => {
    await upload();
    await respond(report({}));

    expect(queueToast).toHaveBeenCalledWith(
      'info',
      'Nothing to import',
      'The file contains no employees.',
    );
    expect(modalRef.hide).toHaveBeenCalled();
  });
});
