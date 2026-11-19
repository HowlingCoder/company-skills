<script setup lang="ts">
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { onBeforeUnmount, ref, watch } from 'vue'
import { PROFICIENCY_LEVELS } from '@/skills/levels'
import SkillPicker from '@/skills/SkillPicker.vue'
import {
  type ActiveFilter,
  SEARCH_DEBOUNCE_MS,
  withoutSkill,
  withSkill,
} from './employee-filter-url'

const filter = defineModel<ActiveFilter>('filter', { required: true })

// the field updates at once, the filter only after the typing pause
const query = ref(filter.value.q)
let debounce: ReturnType<typeof setTimeout> | undefined

// the filter can change from outside (reset button, URL), then the field follows
watch(
  () => filter.value.q,
  (q) => {
    if (q !== query.value.trim()) query.value = q
  },
)

function onQueryInput(): void {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    const q = query.value.trim()
    if (q !== filter.value.q) filter.value = { ...filter.value, q }
  }, SEARCH_DEBOUNCE_MS)
}

onBeforeUnmount(() => clearTimeout(debounce))

function addTerm(term: string): void {
  filter.value = withSkill(filter.value, term)
}

function removeTerm(value: string): void {
  filter.value = withoutSkill(filter.value, value)
}

const skillMatchOptions = [
  { label: 'All skills', value: 'and' },
  { label: 'Any skill', value: 'or' },
]

// 0 stands for "any level": PrimeVue's Select treats null as "nothing selected"
const levelOptions = [
  { label: 'Any level', value: 0 },
  ...PROFICIENCY_LEVELS.map((level) => ({
    label: `Min. level ${level.value} (${level.name})`,
    value: level.value,
  })),
]

function setSkillMatch(skillMatch: 'and' | 'or'): void {
  filter.value = { ...filter.value, skillMatch }
}

function setMinLevel(value: number): void {
  filter.value = { ...filter.value, minLevel: value || null }
}
</script>

<template>
  <div class="filters">
    <IconField class="grow">
      <InputIcon class="pi pi-search" />
      <InputText
        v-model="query"
        placeholder="Name or email"
        aria-label="Filter by name or email"
        fluid
        @input="onQueryInput"
      />
    </IconField>

    <SkillPicker
      class="grow"
      input-id="employee-filter-skill"
      placeholder="Skill, alias or wildcard (e.g. c*)"
      aria-label="Add a skill to the search"
      allow-free-text
      :min-length="1"
      @skill-selected="addTerm($event.name)"
      @term-entered="addTerm"
    />

    <Select
      :model-value="filter.minLevel ?? 0"
      :options="levelOptions"
      option-label="label"
      option-value="value"
      aria-label="Minimum level"
      @update:model-value="setMinLevel"
    />
  </div>

  <div v-if="filter.skills.length" class="filters">
    <ul class="pills" aria-label="Skills in the search">
      <li v-for="skill in filter.skills" :key="skill">
        <Chip>
          <span>{{ skill }}</span>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            :aria-label="`Remove ${skill} from the search`"
            @click="removeTerm(skill)"
          />
        </Chip>
      </li>
    </ul>

    <SelectButton
      v-if="filter.skills.length > 1"
      :model-value="filter.skillMatch"
      :options="skillMatchOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      aria-label="Combine skills with"
      @update:model-value="setSkillMatch"
    />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.grow {
  flex: 1 1 16rem;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pills :deep(.p-chip) {
  padding-inline-end: 0.25rem;
}
</style>
