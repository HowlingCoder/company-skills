<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref } from 'vue'
import { errorMessage } from '@/api/http'
import { type Employee, type Skill } from '@/api/models'
import { bulkAssign } from '@/api/skill-assignment-api'
import { PROFICIENCY_LEVELS, skillLabel } from '@/skills/levels'
import SkillPicker from '@/skills/SkillPicker.vue'
import { fullName } from './employee-name'

interface Conflict {
  employeeId: string
  name: string
  level: number
}

const props = defineProps<{ employees: Employee[] }>()
const emit = defineEmits<{ close: []; assigned: [] }>()

const toast = useToast()

const skill = ref<Skill>()
const level = ref<number | null>(null)
const saving = ref(false)
const error = ref<string>()

const levelOptions = PROFICIENCY_LEVELS.map((option) => ({
  label: option.label,
  value: option.value,
}))

/**
 * Preview from the table data: who already has the chosen skill. The backend checks the
 * conflicts itself and reports what really happened.
 */
const conflicts = computed<Conflict[]>(() => {
  const skillId = skill.value?.id
  if (!skillId) return []
  return props.employees.flatMap((employee) => {
    const existing = employee.skills.find((s) => s.skill_id === skillId)
    return existing
      ? [{ employeeId: employee.id, name: fullName(employee), level: existing.proficiency_level }]
      : []
  })
})
const conflictHeading = computed(() => {
  const count = conflicts.value.length
  return `${count} of the selected employees already ${count === 1 ? 'has' : 'have'} this skill`
})
const canSubmit = computed(() => !!skill.value && level.value !== null && !saving.value)

// the picker and the "Change" button replace each other, so the focus moves on by hand
async function selectSkill(chosen: Skill): Promise<void> {
  skill.value = chosen
  await nextTick()
  document.querySelector<HTMLElement>('#assign-skill-level [role="combobox"]')?.focus()
}

async function changeSkill(): Promise<void> {
  skill.value = undefined
  await nextTick()
  document.getElementById('assign-skill-skill')?.focus()
}

async function submit(overwrite = false): Promise<void> {
  const chosen = skill.value
  if (!chosen || level.value === null || saving.value) return
  saving.value = true
  error.value = undefined
  try {
    const result = await bulkAssign(
      {
        employee_ids: props.employees.map((employee) => employee.id),
        skill_id: chosen.id,
        proficiency_level: level.value,
      },
      overwrite,
    )
    const changed = result.created.length + result.updated.length
    toast.add({
      severity: changed ? 'success' : 'info',
      summary: changed ? `${chosen.name} assigned` : 'Nothing changed',
      detail:
        `${result.created.length} assigned, ${result.updated.length} updated, ` +
        `${result.skipped.length} skipped.`,
      life: 5000,
    })
    emit('assigned')
  } catch (e) {
    // 404: an employee or the skill was deleted in the meantime; nothing was written
    error.value = errorMessage(e, 404)
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    visible
    modal
    header="Assign skill"
    :close-on-escape="false"
    :style="{ width: '36rem' }"
    @update:visible="emit('close')"
  >
    <Message v-if="error" severity="error" class="block">
      <strong>Skill could not be assigned</strong>
      <p>{{ error }}</p>
    </Message>

    <section class="employees">
      <h3 id="assign-skill-employees">Selected employees ({{ employees.length }})</h3>
      <ul aria-labelledby="assign-skill-employees">
        <li v-for="employee in employees" :key="employee.id">{{ fullName(employee) }}</li>
      </ul>
    </section>

    <div class="field">
      <label id="assign-skill-skill-label" for="assign-skill-skill" class="field-label"
        >Skill</label
      >
      <div v-if="skill" class="chosen">
        <span>{{ skillLabel(skill) }}</span>
        <Button label="Change" size="small" text @click="changeSkill" />
      </div>
      <SkillPicker v-else input-id="assign-skill-skill" @skill-selected="selectSkill" />
    </div>

    <div class="field">
      <span id="assign-skill-level-label" class="field-label">Level</span>
      <Select
        id="assign-skill-level"
        v-model="level"
        :options="levelOptions"
        option-label="label"
        option-value="value"
        placeholder="Select level"
        aria-labelledby="assign-skill-level-label"
        fluid
      />
    </div>

    <section v-if="conflicts.length" class="conflicts">
      <Message severity="warn">
        <strong>{{ conflictHeading }}</strong>
        <p>Keep their levels, or overwrite them with the level chosen above.</p>
      </Message>
      <ul aria-label="Employees who already have this skill">
        <li v-for="conflict in conflicts" :key="conflict.employeeId">
          {{ conflict.name }}: level {{ conflict.level }}
        </li>
      </ul>
    </section>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="emit('close')" />
      <template v-if="conflicts.length">
        <!-- secondary: overwriting can also lower levels -->
        <Button
          label="Overwrite levels"
          severity="secondary"
          :disabled="!canSubmit"
          @click="submit(true)"
        />
        <Button label="Keep existing levels" :disabled="!canSubmit" @click="submit()" />
      </template>
      <Button v-else label="Assign" :disabled="!canSubmit" :loading="saving" @click="submit()" />
    </template>
  </Dialog>
</template>

<style scoped>
.block {
  margin-bottom: 1.5rem;
}

.block p,
.conflicts p {
  margin: 0.25rem 0 0;
}

.employees {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.employees h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.employees ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.employees li {
  padding: 0.125rem 0.5rem;
  border-radius: var(--p-border-radius-sm);
  background: var(--p-content-hover-background);
}

.field {
  margin-bottom: 1.25rem;
}

.field-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.chosen {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.conflicts {
  padding-top: 1.25rem;
  border-top: 1px solid var(--p-content-border-color);
}

.conflicts ul {
  margin: 1rem 0 0;
}
</style>
