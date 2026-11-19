<script setup lang="ts">
import Tag from 'primevue/tag'
import { type EmployeeSkill } from '@/api/models'
import { skillHue } from '@/skills/skill-hue'

// One badge: hue from the skill name, color strength from the level (tokens in main.css).
// The level is printed as a number too, so color is never the only carrier of information.
defineProps<{
  skill: EmployeeSkill
  /** Outlined instead of filled: another skill of the row matches the search. */
  unmatched?: boolean
}>()
</script>

<template>
  <Tag
    class="skill-badge"
    :class="[
      `skill-level-${skill.proficiency_level}`,
      { 'skill-matched': skill.matched, 'skill-unmatched': unmatched },
    ]"
    :style="{ '--skill-hue': skillHue(skill.name) }"
  >
    {{ skill.name }} {{ skill.proficiency_level }}
    <span v-if="skill.matched" class="p-hidden-accessible">(matches the search)</span>
  </Tag>
</template>
