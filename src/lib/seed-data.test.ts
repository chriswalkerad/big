import { describe, it, expect } from 'vitest'
import { seedDocuments, seedProject, seedProjects, seedSignals } from './seed-data'
import { PEOPLE } from './people'

describe('seed projects', () => {
  it('seeds both announced franchises with exact ids', () => {
    expect(seedProjects.map((p) => p.id)).toEqual(['proj-eloise', 'proj-speed-anime'])
  })

  it('exposes Eloise as the default single-project export', () => {
    expect(seedProject).toBe(seedProjects[0])
    expect(seedProject.id).toBe('proj-eloise')
  })

  it('every document belongs to a seeded project', () => {
    const ids = new Set(seedProjects.map((p) => p.id))
    for (const doc of seedDocuments) {
      expect(ids.has(doc.projectId), `${doc.id} -> ${doc.projectId}`).toBe(true)
    }
  })

  it('seeds 13 documents (8 Eloise + 5 Speed)', () => {
    expect(seedDocuments).toHaveLength(13)
    expect(seedDocuments.filter((d) => d.projectId === 'proj-eloise')).toHaveLength(8)
    expect(seedDocuments.filter((d) => d.projectId === 'proj-speed-anime')).toHaveLength(5)
  })
})

describe('people roster', () => {
  const ids = new Set(PEOPLE.map((p) => p.id))

  it('has 10 members with stable kebab ids and a role each', () => {
    expect(PEOPLE).toHaveLength(10)
    for (const person of PEOPLE) {
      expect(person.id).toMatch(/^person-[a-z]+-[a-z]+$/)
      expect(person.name.length).toBeGreaterThan(0)
      expect(person.role.length).toBeGreaterThan(0)
    }
  })

  it('has unique ids', () => {
    expect(ids.size).toBe(PEOPLE.length)
  })
})

describe('seed owners and reviewers', () => {
  const ids = new Set(PEOPLE.map((p) => p.id))

  it('gives every project an owner drawn from the roster', () => {
    for (const project of seedProjects) {
      expect(project.owner).toBeDefined()
      expect(ids.has(project.owner.id), `${project.id} owner`).toBe(true)
    }
  })

  it('owns Eloise by Maya Kambe and Speed by Ben Beale', () => {
    const byId = Object.fromEntries(seedProjects.map((p) => [p.id, p]))
    expect(byId['proj-eloise'].owner.id).toBe('person-maya-kambe')
    expect(byId['proj-speed-anime'].owner.id).toBe('person-ben-beale')
  })

  it('sets a roster reviewer on every submitted document and none on drafts', () => {
    for (const doc of seedDocuments) {
      if (doc.status === 'draft') {
        expect(doc.reviewer, `${doc.id} draft`).toBeUndefined()
      } else {
        expect(doc.reviewer, `${doc.id} reviewer`).toBeDefined()
        expect(ids.has(doc.reviewer!.id), `${doc.id} reviewer id`).toBe(true)
      }
    }
  })
})

describe('seed signals', () => {
  it('has the six signals with exact ids in order', () => {
    expect(seedSignals.map((s) => s.id)).toEqual([
      'clarity',
      'completeness',
      'brand_safety',
      'hook_strength',
      'character',
      'franchise_fit',
    ])
  })
})

describe('seed documents', () => {
  it('every inline issue quote is an exact substring of its document body', () => {
    for (const doc of seedDocuments) {
      const review = doc.submittedSnapshot?.review
      if (!review) continue
      for (const signal of review.signals) {
        for (const issue of signal.issues) {
          expect(
            doc.body.includes(issue.quote),
            `"${issue.quote}" not found in ${doc.id}`,
          ).toBe(true)
        }
      }
    }
  })

  it('matches the designed verdicts and flag counts', () => {
    const byId = Object.fromEntries(seedDocuments.map((d) => [d.id, d]))
    expect(byId['doc-midnight-caper'].submittedSnapshot?.review.verdict).toEqual({ label: 'looks_ready', flagCount: 0 })
    expect(byId['doc-new-friend'].submittedSnapshot?.review.verdict).toEqual({ label: 'needs_work', flagCount: 3 })
    expect(byId['doc-haunted-elevator'].submittedSnapshot?.review.verdict).toEqual({ label: 'not_ready', flagCount: 2 })
    expect(byId['doc-rooftop-stub'].submittedSnapshot).toBeUndefined()
  })

  it('flagCount equals the number of signals scoring below threshold', () => {
    const thresholds = { clarity: 7, completeness: 7, brand_safety: 7, hook_strength: 6, character: 6, franchise_fit: 6 } as Record<string, number>
    for (const doc of seedDocuments) {
      const review = doc.submittedSnapshot?.review
      if (!review) continue
      const below = review.signals.filter((s) => s.score < thresholds[s.signalId]).length
      expect(below).toBe(review.verdict.flagCount)
    }
  })
})
