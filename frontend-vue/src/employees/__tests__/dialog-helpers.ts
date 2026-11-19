import { mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { type Component } from 'vue'

/** Mounts a dialog; PrimeVue renders it into document.body. */
export function mountDialog(component: Component, props: Record<string, unknown> = {}): VueWrapper {
  return mount(component, {
    props,
    attachTo: document.body,
    global: { plugins: [[PrimeVue, { theme: 'none' }]] },
  })
}

export function dialog(): HTMLElement {
  return document.body.querySelector<HTMLElement>('.p-dialog')!
}

export function dialogButton(label: string): HTMLButtonElement | undefined {
  return Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === label || button.getAttribute('aria-label') === label,
  )
}

export function footerButtons(): string[] {
  return Array.from(dialog().querySelectorAll('.p-dialog-footer button')).map(
    (button) => button.textContent?.trim() ?? '',
  )
}
