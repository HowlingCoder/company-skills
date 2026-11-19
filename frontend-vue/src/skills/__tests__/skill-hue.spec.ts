import { skillHue } from '../skill-hue'
import { describe, expect, it } from 'vitest'

describe('skillHue', () => {
  it('gives the same hue for the same name on every call', () => {
    expect(skillHue('Python')).toBe(skillHue('Python'))
  })

  it('ignores upper and lower case and surrounding whitespace', () => {
    expect(skillHue(' python ')).toBe(skillHue('Python'))
  })

  it('stays within the hue circle, also for unusual names', () => {
    for (const name of [
      '',
      'C',
      'C#',
      'C++',
      '.NET',
      'Vue.js',
      'Größe',
      '日本語',
      'x'.repeat(500),
    ]) {
      const hue = skillHue(name)
      expect(Number.isInteger(hue)).toBe(true)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('separates similar names', () => {
    const hues = ['C', 'C#', 'C++', 'CSS', 'Java', 'JavaScript'].map(skillHue)
    expect(new Set(hues).size).toBe(hues.length)
  })
})
