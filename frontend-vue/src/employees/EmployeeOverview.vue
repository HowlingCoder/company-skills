<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, watch } from 'vue'
import { type Employee } from '@/api/models'
import { SLOW_START_HINT_MS } from '@/api/wake-up'
import { useEmployeesStore } from '@/stores/employees'
import AssignSkillDialog from './AssignSkillDialog.vue'
import EmployeeFilters from './EmployeeFilters.vue'
import {
  EMPTY_FILTER,
  isFilterActive,
  noMatchText as noMatchTextFor,
  toApiFilter,
} from './employee-filter-url'
import { byLastname, fullName } from './employee-name'
import ImportDialog from './ImportDialog.vue'
import SkillBadges from './SkillBadges.vue'
import SkillsDialog from './SkillsDialog.vue'
import { useUrlFilter } from './useUrlFilter'

const store = useEmployeesStore()
const { employees, status, loading } = storeToRefs(store)

/** The filter lives in the URL query, so it survives a reload and can be shared. */
const filter = useUrlFilter()
const filterActive = computed(() => isFilterActive(filter.value))
const noMatchText = computed(() => noMatchTextFor(filter.value))

/** The first load takes long: the free-tier backend of the demo is probably starting. */
const slowStart = ref(false)
const slowStartTimer = setTimeout(() => (slowStart.value = true), SLOW_START_HINT_MS)
onUnmounted(() => clearTimeout(slowStartTimer))

const selected = ref<Employee[]>([])
const selectedCount = computed(() => selected.value.length)

// PrimeVue labels every row checkbox "Row Selected/Unselected"; name the employee instead
const selectionPt = {
  pcRowCheckbox: ({ parent }: { parent: { props: { value: Employee } } }) => ({
    input: { 'aria-label': `Select ${fullName(parent.props.value)}` },
  }),
  pcHeaderCheckbox: { input: { 'aria-label': 'Select all employees' } },
}

const importOpen = ref(false)
const assignOpen = ref(false)
const skillsEmployee = ref<Employee | null>(null)

function load(): void {
  // the selection refers to rows of the previous load
  selected.value = []
  store.load(toApiFilter(filter.value))
}

watch(filter, load, { immediate: true })

function resetFilter(): void {
  filter.value = EMPTY_FILTER
}

function onSkillsSaved(): void {
  skillsEmployee.value = null
  load()
}

function onSkillAssigned(): void {
  assignOpen.value = false
  load()
}
</script>

<template>
  <section aria-labelledby="employees-heading">
    <div class="toolbar">
      <h2 id="employees-heading">Employees</h2>
      <div class="actions">
        <Button
          :label="selectedCount ? `Assign skill (${selectedCount})` : 'Assign skill'"
          severity="secondary"
          :disabled="!selectedCount"
          :title="selectedCount ? undefined : 'Select employees in the table first'"
          @click="assignOpen = true"
        />
        <Button label="Import CSV" @click="importOpen = true" />
      </div>
    </div>

    <EmployeeFilters v-model:filter="filter" />

    <div v-if="status === 'loading'" class="spinner">
      <ProgressSpinner aria-label="Loading employees" />
      <p v-if="slowStart" role="status">
        The demo runs on a free tier: the server is waking up. This can take about a minute.
      </p>
    </div>

    <Message v-else-if="status === 'error'" severity="error">
      <strong>Employees could not be loaded</strong>
      <p>The server did not answer as expected. Please try again.</p>
      <Button label="Retry" size="small" severity="danger" outlined @click="load" />
    </Message>

    <template v-else>
      <DataTable
        :value="employees"
        v-model:selection="selected"
        data-key="id"
        :loading="loading"
        :sort-field="byLastname"
        :sort-order="1"
        striped-rows
        scrollable
        table-style="min-width: 60rem"
      >
        <Column selection-mode="multiple" header-style="width: 3rem" :pt="selectionPt" />
        <Column header="Name" :sort-field="byLastname" sortable>
          <template #body="{ data }">{{ fullName(data) }}</template>
        </Column>
        <Column field="email" header="Email" sortable />
        <Column field="age" header="Age" sortable />
        <Column header="Skills">
          <template #body="{ data }">
            <SkillBadges :skills="(data as Employee).skills" />
          </template>
        </Column>
        <Column header-style="width: 4rem">
          <template #header><span class="p-hidden-accessible">Actions</span></template>
          <template #body="{ data }">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              :aria-label="`Manage skills of ${fullName(data)}`"
              @click="skillsEmployee = data"
            />
          </template>
        </Column>

        <template #empty>
          <div v-if="filterActive" class="empty-state">
            <i class="pi pi-search" aria-hidden="true"></i>
            <strong>No employees match</strong>
            <p>{{ noMatchText }}</p>
            <Button label="Reset filters" severity="secondary" @click="resetFilter" />
          </div>
          <div v-else class="empty-state">
            <i class="pi pi-users" aria-hidden="true"></i>
            <strong>No employees yet</strong>
            <p>Import a CSV file to add employees.</p>
            <Button label="Import CSV" severity="secondary" @click="importOpen = true" />
          </div>
        </template>
      </DataTable>

      <!-- second button after the table, so keyboard users need not tab back through all rows -->
      <div v-if="selectedCount" class="after-table">
        <span>{{ selectedCount }} selected</span>
        <Button
          :label="`Assign skill (${selectedCount})`"
          severity="secondary"
          @click="assignOpen = true"
        />
      </div>
    </template>

    <ImportDialog v-if="importOpen" @close="importOpen = false" @imported="load" />
    <AssignSkillDialog
      v-if="assignOpen"
      :employees="selected"
      @close="assignOpen = false"
      @assigned="onSkillAssigned"
    />
    <SkillsDialog
      v-if="skillsEmployee"
      :employee="skillsEmployee"
      @close="skillsEmployee = null"
      @saved="onSkillsSaved"
    />
  </section>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.toolbar h2 {
  margin: 0;
}

.actions,
.after-table {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.after-table {
  margin-top: 1.5rem;
}

.spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  color: var(--p-text-muted-color);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  text-align: center;
}

.empty-state .pi {
  font-size: 2rem;
}

.empty-state p {
  margin: 0 0 0.5rem;
}
</style>
