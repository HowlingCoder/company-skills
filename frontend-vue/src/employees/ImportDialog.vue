<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import FileUpload, { type FileUploadUploaderEvent } from 'primevue/fileupload'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { importEmployees } from '@/api/employee-api'
import { errorMessage } from '@/api/http'
import { type RowError } from '@/api/models'

const emit = defineEmits<{
  close: []
  /** The employee list changed; the dialog may stay open to show failed rows. */
  imported: []
}>()

const toast = useToast()

const uploading = ref(false)
/** Message for a file that was rejected as a whole. */
const fileError = ref<string>()
/** Rows the backend skipped; the rest of the file was imported. */
const rowErrors = ref<RowError[]>([])
const importedCount = ref(0)
const partialImportHeading = computed(
  () => `${importedCount.value} of ${importedCount.value + rowErrors.value.length} rows imported`,
)

function clearResult(): void {
  fileError.value = undefined
  rowErrors.value = []
}

async function upload(event: FileUploadUploaderEvent): Promise<void> {
  const file = Array.isArray(event.files) ? event.files[0] : event.files
  if (!file) return
  clearResult()
  uploading.value = true
  try {
    const report = await importEmployees(file)
    emit('imported')
    if (report.failed_count > 0) {
      rowErrors.value = report.errors
      importedCount.value = report.imported_count
      toast.add({
        severity: 'warn',
        summary: 'Import incomplete',
        detail: `${report.imported_count} imported, ${report.failed_count} failed.`,
        life: 5000,
      })
      return
    }
    toast.add(
      report.imported_count === 0
        ? {
            severity: 'info',
            summary: 'Nothing to import',
            detail: 'The file contains no employees.',
            life: 5000,
          }
        : {
            severity: 'success',
            summary: 'Employees imported',
            detail: `${report.imported_count} ${report.imported_count === 1 ? 'employee' : 'employees'} imported.`,
            life: 5000,
          },
    )
    emit('close')
  } catch (e) {
    // 400: the backend explains what is wrong with the file
    fileError.value = errorMessage(e, 400)
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <Dialog
    visible
    modal
    dismissable-mask
    header="Import employees"
    :style="{ width: '36rem' }"
    @update:visible="emit('close')"
  >
    <p class="intro">
      CSV file with the columns Lastname, Firstname, E-Mail and Age. Employees that already exist
      are updated by their e-mail address.
    </p>

    <FileUpload
      mode="basic"
      name="file"
      accept=".csv"
      auto
      custom-upload
      choose-label="Choose CSV file"
      :disabled="uploading"
      @select="clearResult"
      @uploader="upload"
    />

    <Message v-if="fileError" severity="error" class="result">
      <strong>File could not be imported</strong>
      <p>{{ fileError }}</p>
    </Message>

    <template v-if="rowErrors.length">
      <Message severity="warn" class="result">
        <strong>{{ partialImportHeading }}</strong>
        <p>Correct the rows below and import the file again.</p>
      </Message>
      <ul class="row-errors" aria-label="Rows that were not imported">
        <li v-for="rowError in rowErrors" :key="rowError.line">
          Line {{ rowError.line }}: {{ rowError.message }}
        </li>
      </ul>
    </template>

    <template #footer>
      <!-- after a partial import some rows are already saved, so there is nothing left to cancel -->
      <Button
        :label="rowErrors.length ? 'Close' : 'Cancel'"
        severity="secondary"
        @click="emit('close')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.intro {
  margin-top: 0;
}

.result {
  margin-top: 1.5rem;
}

.result p {
  margin: 0.25rem 0 0;
}

.row-errors {
  margin: 1rem 0 0;
}
</style>
