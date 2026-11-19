<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, useTemplateRef } from 'vue'
import { type EmployeeSkill } from '@/api/models'
import SkillBadge from './SkillBadge.vue'
import { overflowLabel, splitSkills } from './skill-order'

const props = defineProps<{
  /** Skills as delivered by the backend: sorted by level, highest first. */
  skills: EmployeeSkill[]
}>()

const split = computed(() => splitSkills(props.skills))

const popover = useTemplateRef('popover')
</script>

<template>
  <div class="skill-badges">
    <SkillBadge
      v-for="skill in split.visible"
      :key="skill.skill_id"
      :skill="skill"
      :unmatched="split.hasMatches && !skill.matched"
    />
    <template v-if="split.overflow.length">
      <Button
        class="skill-overflow"
        :label="`+${split.overflow.length}`"
        :aria-label="overflowLabel(split.overflow.length)"
        size="small"
        severity="secondary"
        rounded
        @click="popover?.toggle($event)"
      />
      <Popover ref="popover">
        <div class="skill-badges skill-badges--wrap">
          <SkillBadge
            v-for="skill in split.overflow"
            :key="skill.skill_id"
            :skill="skill"
            :unmatched="split.hasMatches && !skill.matched"
          />
        </div>
      </Popover>
    </template>
  </div>
</template>

<style scoped>
.skill-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.skill-badges--wrap {
  flex-wrap: wrap;
  max-width: 20rem;
}

.skill-overflow {
  padding-block: 0.125rem;
}
</style>
