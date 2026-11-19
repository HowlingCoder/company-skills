import { request } from './http'
import { type BulkAssignment, type BulkAssignmentResult } from './models'

/** Assigns one skill to many employees; existing levels are kept unless overwrite is set. */
export async function bulkAssign(
  assignment: BulkAssignment,
  overwrite = false,
): Promise<BulkAssignmentResult> {
  const params = new URLSearchParams()
  if (overwrite) {
    params.set('on_conflict', 'overwrite')
  }
  const apiParams = params.size > 0 ? '?' + params.toString() : ''

  return request<BulkAssignmentResult>('/api/skill-assignments/bulk' + apiParams, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assignment),
  })
}
