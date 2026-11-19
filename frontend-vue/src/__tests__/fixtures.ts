import { type Employee } from '@/api/models'

/** Two employees as the backend sends them, ordered by last name. */
export const employees: Employee[] = [
  {
    id: '1',
    firstname: 'Max',
    lastname: 'Muster',
    email: 'max.muster@example.com',
    age: 34,
    skills: [
      { skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 5, matched: false },
      { skill_id: 's2', name: 'Docker', alias: null, proficiency_level: 2, matched: false },
    ],
  },
  {
    id: '2',
    firstname: 'Anna',
    lastname: 'Schmidt',
    email: 'anna.schmidt@example.com',
    age: 29,
    skills: [],
  },
]
