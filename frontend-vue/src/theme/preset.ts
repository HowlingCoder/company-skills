import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

// Aura's default text colors on light backgrounds fall below the WCAG AA contrast of 4.5:1
// (white on emerald-500 is 2.5:1); darker shades in light mode, lighter ones in dark mode.
const severityText = {
  info: 'light-dark({blue.700}, {blue.400})',
  success: 'light-dark({green.800}, {green.400})',
  warn: 'light-dark({yellow.800}, {yellow.400})',
  error: 'light-dark({red.700}, {red.400})',
}

const severityColors = Object.fromEntries(
  Object.entries(severityText).map(([severity, color]) => [severity, { color }]),
)

export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      color: 'light-dark({primary.700}, {primary.400})',
      hoverColor: 'light-dark({primary.800}, {primary.300})',
      activeColor: 'light-dark({primary.900}, {primary.200})',
    },
  },
  components: {
    message: severityColors,
    toast: severityColors,
  },
})
