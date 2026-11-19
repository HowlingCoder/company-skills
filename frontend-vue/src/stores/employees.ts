import { defineStore } from 'pinia'
import { listEmployees } from '@/api/employee-api'
import { type Employee, type EmployeeFilter } from '@/api/models'

/** 'loading' only until the first answer; later loads keep the table and set `loading`. */
export type LoadStatus = 'loading' | 'loaded' | 'error'

// Number of the newest request; an older answer that arrives later is dropped
let latestRequest = 0

/** The employee list, shared by every component that calls useEmployeesStore(). */
export const useEmployeesStore = defineStore('employees', {
  state: () => ({
    employees: [] as Employee[],
    status: 'loading' as LoadStatus,
    /** True while any request runs, also a reload; `status` only tells the first one. */
    loading: false,
  }),
  actions: {
    async load(filter: EmployeeFilter = {}): Promise<void> {
      const request = ++latestRequest
      this.loading = true
      try {
        const employees = await listEmployees(filter)
        if (request !== latestRequest) return
        this.employees = employees
        this.status = 'loaded'
      } catch {
        if (request !== latestRequest) return
        this.status = 'error'
      } finally {
        if (request === latestRequest) this.loading = false
      }
    },
  },
})
