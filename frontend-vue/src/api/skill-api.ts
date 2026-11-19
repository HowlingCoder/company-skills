import { request } from './http'
import { type Skill } from './models'

export async function listSkills(q: string = ''): Promise<Skill[]> {
  const params = new URLSearchParams()

  const term = q.trim()

  if (term) {
    params.set('q', term)
  }

  const apiParams = params.size > 0 ? '?' + params.toString() : ''

  return request<Skill[]>('/api/skills' + apiParams)
}
