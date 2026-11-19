<script setup lang="ts">
import AutoComplete, { type AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import { ref, useTemplateRef } from 'vue'
import { type Skill } from '@/api/models'
import { listSkills } from '@/api/skill-api'
import { skillLabel } from './levels'

interface Suggestion {
  skill: Skill
  label: string
}

const props = withDefaults(
  defineProps<{
    inputId: string
    placeholder?: string
    ariaLabel?: string
    /** Skills that are not offered, e.g. because they are already assigned. */
    excludedSkillIds?: string[]
    /**
     * Lets Enter submit the typed text as it is, e.g. a wildcard like "c*". No suggestion is
     * preselected then, so Enter only picks a suggestion the user moved to.
     */
    allowFreeText?: boolean
    /** Typed characters before suggestions open; 0 opens the list as soon as the input has focus. */
    minLength?: number
  }>(),
  {
    placeholder: 'Search the skill catalog',
    ariaLabel: undefined,
    excludedSkillIds: () => [],
    allowFreeText: false,
    minLength: 0,
  },
)

const emit = defineEmits<{
  skillSelected: [skill: Skill]
  termEntered: [term: string]
}>()

const text = ref<string | Suggestion>('')
const suggestions = ref<Suggestion[]>([])
/** Why typed text leads to an empty list: nothing matches, or every match is excluded. */
const emptyReason = ref<'no-match' | 'excluded'>()

// hide() is a method of the component, missing in its published types
const autocomplete = useTemplateRef<{ hide(): void }>('autocomplete')

let latestSearch = 0

async function search(query: string): Promise<void> {
  const request = ++latestSearch
  const skills = await listSkills(query).catch(() => [] as Skill[])
  if (request !== latestSearch) return
  const offered = skills.filter((skill) => !props.excludedSkillIds.includes(skill.id))
  emptyReason.value =
    !query.trim() || offered.length ? undefined : skills.length ? 'excluded' : 'no-match'
  suggestions.value = offered.map((skill) => ({ skill, label: skillLabel(skill) }))
}

function onSelect(event: AutoCompleteOptionSelectEvent): void {
  emptyReason.value = undefined
  text.value = ''
  emit('skillSelected', (event.value as Suggestion).skill)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || !props.allowFreeText) return
  // the autocomplete handles Enter first: after a picked suggestion the text is empty
  setTimeout(() => {
    const term = typeof text.value === 'string' ? text.value.trim() : ''
    if (term) {
      text.value = ''
      // a lookup still under way for the typed text must not reopen the list
      latestSearch++
      autocomplete.value?.hide()
      emit('termEntered', term)
    }
  })
}

function focus(): void {
  document.getElementById(props.inputId)?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div>
    <AutoComplete
      ref="autocomplete"
      v-model="text"
      :input-id="inputId"
      :suggestions="suggestions"
      option-label="label"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :min-length="minLength"
      :complete-on-focus="minLength === 0"
      :delay="200"
      :auto-option-focus="!allowFreeText"
      :show-empty-message="false"
      fluid
      @complete="search($event.query)"
      @option-select="onSelect"
      @keydown="onKeydown"
    />
    <p v-if="!allowFreeText && emptyReason" class="picker-hint" role="status">
      {{ emptyReason === 'excluded' ? 'Already assigned.' : 'No matching skill in the catalog.' }}
    </p>
  </div>
</template>

<style scoped>
.picker-hint {
  margin: 0.5rem 0 0;
  color: var(--p-text-muted-color);
}
</style>
