<script setup lang="ts">
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import EmployeeOverview from './employees/EmployeeOverview.vue'
import { useThemeMode } from './theme/useThemeMode'

const { isDark, toggle } = useThemeMode()
</script>

<template>
  <header class="app-header">
    <h1>Company Skill Management</h1>
    <Button
      :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      severity="secondary"
      text
      rounded
      @click="toggle"
    />
  </header>

  <main class="app-main">
    <EmployeeOverview />
  </main>

  <Toast />
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.app-header h1 {
  margin: 0;
  font-size: 1.25rem;
}

.app-main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem;
}
</style>
