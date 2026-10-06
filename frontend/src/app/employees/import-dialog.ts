import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FileUploadConfig,
  FileUploadResult,
  SiFileUploaderComponent,
} from '@siemens/element-ng/file-uploader';
import { SiInlineNotificationComponent } from '@siemens/element-ng/inline-notification';
import { ModalRef } from '@siemens/element-ng/modal';
import { SiToastNotificationService } from '@siemens/element-ng/toast-notification';
import { ImportReport, RowError } from '../api/models';

/** Sent through ModalRef.message whenever an import changed the employee list. */
export const EMPLOYEES_IMPORTED = 'imported';

const UNEXPECTED_ERROR = 'The server did not answer as expected. Please try again.';

@Component({
  imports: [SiFileUploaderComponent, SiInlineNotificationComponent],
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.html',
})
export class ImportDialog {
  protected readonly modalRef = inject<ModalRef<ImportDialog, string>>(ModalRef);
  private readonly toasts = inject(SiToastNotificationService);

  protected readonly uploadConfig: FileUploadConfig = {
    method: 'POST',
    url: '/api/employees/import',
    fieldName: 'file',
    headers: {},
    responseType: 'json',
  };

  /** Message for a file that was rejected as a whole. */
  protected readonly fileError = signal<string | undefined>(undefined);
  /** Rows the backend skipped; the rest of the file was imported. */
  protected readonly rowErrors = signal<RowError[]>([]);
  private readonly importedCount = signal(0);
  // the uploader shows a green tick for the upload itself, so the heading states what was imported
  protected readonly partialImportHeading = computed(() => {
    const total = this.importedCount() + this.rowErrors().length;
    return `${this.importedCount()} of ${total} rows imported`;
  });

  protected clearResult(): void {
    this.fileError.set(undefined);
    this.rowErrors.set([]);
  }

  protected onUploadCompleted(result: FileUploadResult): void {
    this.clearResult();
    if (result.error || !result.response) {
      this.fileError.set(this.fileErrorMessage(result.error));
      return;
    }

    const report = result.response.body as ImportReport;
    this.modalRef.message.next(EMPLOYEES_IMPORTED);
    if (report.failed_count > 0) {
      this.rowErrors.set(report.errors);
      this.importedCount.set(report.imported_count);
      this.toasts.queueToastNotification(
        'warning',
        'Import incomplete',
        `${report.imported_count} imported, ${report.failed_count} failed.`,
      );
      return;
    }

    if (report.imported_count === 0) {
      this.toasts.queueToastNotification(
        'info',
        'Nothing to import',
        'The file contains no employees.',
      );
    } else {
      this.toasts.queueToastNotification(
        'success',
        'Employees imported',
        `${report.imported_count} ${report.imported_count === 1 ? 'employee' : 'employees'} imported.`,
      );
    }
    this.modalRef.hide();
  }

  private fileErrorMessage(error: Error | undefined): string {
    // 400: the backend explains what is wrong with the file
    if (error instanceof HttpErrorResponse && error.status === 400) {
      const detail = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
    }
    return UNEXPECTED_ERROR;
  }
}
