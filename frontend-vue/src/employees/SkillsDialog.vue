<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { setSkills } from '@/api/employee-api'
import { errorMessage } from '@/api/http'
import { type Employee, type Skill } from '@/api/models'
import { PROFICIENCY_LEVELS, skillLabel } from '@/skills/levels'
import SkillPicker from '@/skills/SkillPicker.vue'
import { fullName } from './employee-name'

interface SkillEntry {
  skillId: string
  label: string
  /** null until a level was picked for a newly added skill */
  level: number | null
}

const props = defineProps<{ employee: Employee }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const toast = useToast()

const entries = ref<SkillEntry[]>(
  props.employee.skills.map((skill) => ({
    skillId: skill.skill_id,
    label: skillLabel(skill),
    level: skill.proficiency_level,
  })),
)
const assignedIds = computed(() => entries.value.map((entry) => entry.skillId))
const canSave = computed(() => entries.value.every((entry) => entry.level !== null))
const saving = ref(false)
const error = ref<string>()

const levelOptions = PROFICIENCY_LEVELS.map((level) => ({ label: level.label, value: level.value }))

const picker = useTemplateRef('picker')
const list = useTemplateRef('list')

function add(skill: Skill): void {
  if (assignedIds.value.includes(skill.id)) return
  entries.value.push({ skillId: skill.id, label: skillLabel(skill), level: null })
}

async function remove(skillId: string): Promise<void> {
  const index = entries.value.findIndex((entry) => entry.skillId === skillId)
  entries.value.splice(index, 1)
  // the clicked button is gone: go on with the row that took its place, else the one before
  await nextTick()
  const buttons = list.value?.querySelectorAll<HTMLButtonElement>('.remove-skill') ?? []
  const next = buttons[Math.min(index, buttons.length - 1)]
  if (next) {
    next.focus()
  } else {
    picker.value?.focus()
  }
}

async function save(): Promise<void> {
  if (!canSave.value || saving.value) return
  saving.value = true
  error.value = undefined
  try {
    await setSkills(
      props.employee.id,
      entries.value.map((entry) => ({ skill_id: entry.skillId, proficiency_level: entry.level! })),
    )
    toast.add({
      severity: 'success',
      summary: 'Skills saved',
      detail: `The skills of ${fullName(props.employee)} were updated.`,
      life: 5000,
    })
    emit('saved')
  } catch (e) {
    // 404: the employee or a skill was deleted in the meantime; the backend names it
    error.value = errorMessage(e, 404)
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    visible
    modal
    :header="`Skills of ${fullName(employee)}`"
    :close-on-escape="false"
    :style="{ width: '36rem' }"
    @update:visible="emit('close')"
  >
    <Message v-if="error" severity="error" class="block">
      <strong>Skills could not be saved</strong>
      <p>{{ error }}</p>
    </Message>

    <ul v-if="entries.length" ref="list" class="skill-list" aria-label="Assigned skills">
      <li v-for="entry in entries" :key="entry.skillId">
        <span class="label">{{ entry.label }}</span>
        <Select
          v-model="entry.level"
          :options="levelOptions"
          option-label="label"
          option-value="value"
          placeholder="Select level"
          :aria-label="`Level of ${entry.label}`"
        />
        <Button
          class="remove-skill"
          icon="pi pi-trash"
          text
          rounded
          severity="secondary"
          :aria-label="`Remove ${entry.label}`"
          @click="remove(entry.skillId)"
        />
      </li>
    </ul>
    <p v-else class="muted">No skills assigned yet.</p>

    <label for="skills-dialog-add" class="field-label">Add skill</label>
    <SkillPicker
      ref="picker"
      input-id="skills-dialog-add"
      :excluded-skill-ids="assignedIds"
      @skill-selected="add"
    />

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="emit('close')" />
      <Button label="Save" :disabled="!canSave || saving" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.block {
  margin-bottom: 1.5rem;
}

.block p {
  margin: 0.25rem 0 0;
}

.skill-list {
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

.skill-list li {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.label {
  flex: 1;
}

.muted {
  margin: 0 0 1.5rem;
  color: var(--p-text-muted-color);
}

.field-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}
</style>
