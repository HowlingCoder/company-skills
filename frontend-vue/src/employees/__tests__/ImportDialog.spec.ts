import { flushPromises, type VueWrapper } from '@vue/test-utils'
import Dialog from 'primevue/dialog'
import FileUpload from 'primevue/fileupload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importEmployees } from '@/api/employee-api'
import { HttpError } from '@/api/http'
import { type ImportReport } from '@/api/models'
import ImportDialog from '../ImportDialog.vue'
import { dialog, dialogButton, footerButtons, mountDialog } from './dialog-helpers'

const toast = { add: vi.fn<(message: object) => void>() }
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))
vi.mock('@/api/employee-api')

const file = new File(['Lastname,Firstname,E-Mail,Age\n'], 'staff.csv', { type: 'text/csv' })

function report(imported: number, errors: { line: number; message: string }[] = []): ImportReport {
  return { imported_count: imported, failed_count: errors.length, imported: [], errors }
}

let wrapper: VueWrapper

async function upload(): Promise<void> {
  wrapper.findComponent(FileUpload).vm.$emit('uploader', { files: [file] })
  await flushPromises()
}

describe('ImportDialog', () => {
  beforeEach(async () => {
    vi.mocked(importEmployees).mockReset()
    toast.add.mockReset()
    wrapper = mountDialog(ImportDialog)
    await flushPromises()
  })

  afterEach(() => wrapper.unmount())

  it('accepts one CSV file and uploads it as soon as it is chosen', () => {
    const uploader = wrapper.findComponent(FileUpload)

    expect(uploader.props('accept')).toBe('.csv')
    expect(uploader.props('multiple')).toBe(false)
    expect(uploader.props('auto')).toBe(true)
  })

  it('sends the chosen file', async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(2))

    await upload()

    expect(importEmployees).toHaveBeenCalledWith(file)
  })

  it('closes with a success toast when every row was imported', async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(2))

    await upload()

    expect(wrapper.emitted('imported')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Employees imported',
        detail: '2 employees imported.',
      }),
    )
  })

  it('stays open and lists every failed row after a partial import', async () => {
    vi.mocked(importEmployees).mockResolvedValue(
      report(3, [
        { line: 2, message: 'Age must be a number' },
        { line: 5, message: 'E-Mail is missing' },
      ]),
    )

    await upload()

    expect(wrapper.emitted('imported')).toHaveLength(1)
    expect(wrapper.emitted('close')).toBeUndefined()
    const rows = Array.from(
      dialog().querySelectorAll('ul[aria-label="Rows that were not imported"] li'),
    ).map((li) => li.textContent?.trim())
    expect(rows).toEqual(['Line 2: Age must be a number', 'Line 5: E-Mail is missing'])
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn', detail: '3 imported, 2 failed.' }),
    )
  })

  it('states how many rows of a partial import were imported', async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(3, [{ line: 2, message: 'x' }]))

    await upload()

    expect(dialog().textContent).toContain('3 of 4 rows imported')
  })

  it('shows the reason from the backend when the file is rejected', async () => {
    vi.mocked(importEmployees).mockRejectedValue(new HttpError('x', 400, 'Missing column: E-Mail'))

    await upload()

    expect(dialog().textContent).toContain('File could not be imported')
    expect(dialog().textContent).toContain('Missing column: E-Mail')
    expect(wrapper.emitted('imported')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('shows a generic message when the server fails', async () => {
    vi.mocked(importEmployees).mockRejectedValue(new HttpError('x', 500, 'Traceback'))

    await upload()

    expect(dialog().textContent).toContain('The server did not answer as expected.')
    expect(dialog().textContent).not.toContain('Traceback')
  })

  it('clears an old result when another file is chosen', async () => {
    vi.mocked(importEmployees).mockRejectedValue(new HttpError('x', 400, 'Missing column'))
    await upload()

    wrapper.findComponent(FileUpload).vm.$emit('select', { files: [file] })
    await flushPromises()

    expect(dialog().textContent).not.toContain('File could not be imported')
  })

  it('closes without an upload on cancel', async () => {
    dialogButton('Cancel')!.click()
    await flushPromises()

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(importEmployees).not.toHaveBeenCalled()
  })

  it('offers "Close" instead of "Cancel" once rows were imported', async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(1, [{ line: 2, message: 'x' }]))

    await upload()

    expect(footerButtons()).toEqual(['Close'])
  })

  it('tells the user when the file has a header but no employees', async () => {
    vi.mocked(importEmployees).mockResolvedValue(report(0))

    await upload()

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info', summary: 'Nothing to import' }),
    )
  })

  it('can be left with Escape or a click outside', () => {
    const props = wrapper.findComponent(Dialog).props()

    expect(props.closeOnEscape).toBe(true)
    expect(props.dismissableMask).toBe(true)
  })
})
