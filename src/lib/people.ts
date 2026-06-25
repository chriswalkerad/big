// The creative-department roster at Big Shot Pictures. Projects carry an `owner`
// (their creator) and documents get a `reviewer` chosen at submission — both drawn
// from this list. Ids are stable kebab-case (`person-<first>-<last>`) so seeded
// owners/reviewers stay consistent across re-seeds. Shared `Person` type lives in
// @/types.

import type { Person } from '@/types'

/** The creative-department roster, in display order. */
export const PEOPLE: Person[] = [
  { id: 'person-ben-beale', name: 'Ben Beale', role: 'Executive Creative Director' },
  { id: 'person-bill-buckley', name: 'Bill Buckley', role: 'SVP, Animation Production' },
  { id: 'person-rory-larochelle', name: 'Rory Larochelle', role: 'Head of Franchise & Partnerships' },
  { id: 'person-maya-kambe', name: 'Maya Kambe', role: 'Animation Development & Production Executive' },
  { id: 'person-omar-gatica', name: 'Omar Gatica', role: 'Art Director' },
  { id: 'person-mark-lee', name: 'Mark Lee', role: 'Senior CG Animator' },
  { id: 'person-carla-lutz', name: 'Carla Lutz', role: 'Lead Animator' },
  { id: 'person-luigi-lucarelli', name: 'Luigi Lucarelli', role: 'Character Designer & Concept Artist' },
  { id: 'person-samantha-thomas', name: 'Samantha Thomas', role: 'Franchise & Partnerships Assistant' },
  { id: 'person-kathleen-keefe', name: 'Kathleen Keefe', role: 'Media Producer' },
]

/** Look up a roster member by id (used by the seed to reference people by id). */
export function personById(id: string): Person {
  const person = PEOPLE.find((p) => p.id === id)
  if (!person) throw new Error(`Unknown person id: ${id}`)
  return person
}
