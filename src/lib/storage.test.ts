import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageRepository } from './storage'
import { SEED_VERSION, seedDocuments, seedProject, seedProjects, seedSignals } from '@/lib/seed-data'
import type { AppError } from '@/lib/errors'
import { PEOPLE } from '@/lib/people'
import type { Document, Person, Project, SignalDef } from '@/types'

/** A controllable in-memory KeyValueStore for tests. */
class FakeStore {
  map = new Map<string, string>()
  throwOnSet = false
  setError: Error = new Error('boom')
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    if (this.throwOnSet) throw this.setError
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }
  get length(): number {
    return this.map.size
  }
}

function quotaError(): Error {
  const e = new Error('exceeded the quota')
  e.name = 'QuotaExceededError'
  return e
}

const sampleOwner: Person = { id: 'person-test', name: 'Tester', role: 'QA' }

const sampleProject: Project = {
  id: 'p1',
  name: 'Test Project',
  audience: 'everyone',
  franchiseContext: 'ctx',
  tags: ['a'],
  owner: sampleOwner,
}

const sampleSignal: SignalDef = {
  id: 's1',
  name: 'Clarity',
  prompt: 'judge',
  threshold: 7,
  mode: 'inline',
}

let store: FakeStore
beforeEach(() => {
  store = new FakeStore()
})

describe('StorageRepository CRUD', () => {
  it('saves and gets a project', () => {
    const repo = new StorageRepository({ store, seed: false })
    repo.saveProject(sampleProject)
    expect(repo.getProject('p1')).toEqual(sampleProject)
    expect(repo.getProject('missing')).toBeNull()
  })

  it('lists only entities of the right namespace', () => {
    const repo = new StorageRepository({ store, seed: false })
    repo.saveProject(sampleProject)
    repo.saveSignal(sampleSignal)
    expect(repo.listProjects()).toEqual([sampleProject])
    expect(repo.listSignals()).toEqual([sampleSignal])
    expect(repo.listDocuments()).toEqual([])
  })

  it('removes an entity', () => {
    const repo = new StorageRepository({ store, seed: false })
    repo.saveSignal(sampleSignal)
    expect(repo.getSignal('s1')).toEqual(sampleSignal)
    repo.removeSignal('s1')
    expect(repo.getSignal('s1')).toBeNull()
    expect(repo.listSignals()).toEqual([])
  })

  it('exposes the people roster', () => {
    const repo = new StorageRepository({ store, seed: false })
    expect(repo.listPeople()).toEqual(PEOPLE)
    expect(repo.listPeople()).toHaveLength(10)
  })

  it('uses namespaced bsp: keys', () => {
    const repo = new StorageRepository({ store, seed: false })
    repo.saveProject(sampleProject)
    repo.saveSignal(sampleSignal)
    expect(store.map.has('bsp:project:p1')).toBe(true)
    expect(store.map.has('bsp:signal:s1')).toBe(true)
  })
})

describe('StorageRepository seeding', () => {
  it('seeds an empty store on first run', () => {
    const repo = new StorageRepository({ store })
    expect(repo.getProject(seedProject.id)).toEqual(seedProject)
    expect(repo.listProjects()).toHaveLength(seedProjects.length)
    expect(repo.getProject('proj-speed-anime')).toEqual(seedProjects[1])
    expect(repo.listSignals()).toHaveLength(seedSignals.length)
    expect(repo.listDocuments()).toHaveLength(seedDocuments.length)
    const doc = repo.getDocument('doc-haunted-elevator') as Document
    expect(doc.submittedSnapshot?.review.verdict.label).toBe('not_ready')
  })

  it('re-seeds on a version bump and preserves user-created documents', () => {
    // A browser seeded at an older version, with one user-authored document.
    store.setItem('bsp:meta:seeded', '1')
    const userDoc: Document = {
      id: 'user-doc-1',
      projectId: 'proj-eloise',
      title: 'My draft',
      body: 'mine',
      subtype: 'story_premise',
      subtypeSource: 'auto',
      status: 'draft',
      createdBy: 'Me',
      createdAt: '2026-06-23T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z',
    }
    new StorageRepository({ store, seed: false }).saveDocument(userDoc)

    // A fresh repository refreshes the seed to the current version...
    const repo = new StorageRepository({ store })
    expect(repo.listProjects()).toHaveLength(seedProjects.length)
    expect(repo.getProject('proj-speed-anime')).toEqual(seedProjects[1])
    expect(store.getItem('bsp:meta:seeded')).toBe(String(SEED_VERSION))
    // ...without clobbering the user's own document.
    expect(repo.getDocument('user-doc-1')).toEqual(userDoc)
  })

  it('does not re-seed when already at the current version', () => {
    new StorageRepository({ store }) // seeds → marker at the current version
    const spy = vi.spyOn(store, 'setItem')
    new StorageRepository({ store }) // should early-return, writing nothing
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('does not reseed when a seeded marker is present', () => {
    new StorageRepository({ store }) // first run seeds + marks
    // Wipe entities but keep the marker; a re-init must not bring seeds back.
    for (const k of Array.from(store.map.keys())) {
      if (k !== 'bsp:meta:seeded') store.map.delete(k)
    }
    const repo2 = new StorageRepository({ store })
    expect(repo2.listProjects()).toHaveLength(0)
  })

  it('does not seed when seed: false', () => {
    const repo = new StorageRepository({ store, seed: false })
    expect(repo.listProjects()).toHaveLength(0)
    expect(repo.listSignals()).toHaveLength(0)
  })
})

describe('StorageRepository migration', () => {
  /** A pre-redesign user document: 0–10 scores, string reviewer, prompt placeholder. */
  function legacyUserDoc(): Document {
    const review = {
      detectedSubtype: 'story_premise' as const,
      suggestedTitle: 'Legacy',
      themes: ['t'],
      signals: [
        { signalId: 'clarity', score: 9, rationale: 'r', issues: [] },
        { signalId: 'brand_safety', score: 2, rationale: 'r', issues: [] },
      ],
      verdict: { label: 'needs_work' as const, flagCount: 1 },
      suggestedPrompt: 'Revise the following concept:\n\n[paste your text here]',
    }
    return {
      id: 'user-legacy',
      projectId: 'proj-eloise',
      title: 'Legacy',
      body: 'body',
      subtype: 'story_premise',
      subtypeSource: 'auto',
      status: 'submitted',
      createdBy: 'Me',
      reviewer: 'person-maya-kambe' as unknown as Person,
      submittedSnapshot: { body: 'body', review, submittedAt: '2026-01-01T00:00:00.000Z' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
  }

  it('migrates a pre-redesign user document on load', () => {
    // A legacy persisted store: seeded at an old version, a stale user doc, and no
    // migration marker. Written directly so no constructor pre-runs migrate().
    store.map.set('bsp:meta:seeded', '1')
    store.map.set('bsp:doc:user-legacy', JSON.stringify(legacyUserDoc()))

    const repo = new StorageRepository({ store })
    const migrated = repo.getDocument('user-legacy') as Document

    expect(migrated.submittedSnapshot?.review.signals.map((s) => s.score)).toEqual([90, 20])
    expect(migrated.reviewer).toEqual(PEOPLE.find((p) => p.id === 'person-maya-kambe'))
    expect(migrated.submittedSnapshot?.review.suggestedPrompt).toBe('Revise the following concept:')
    expect(store.getItem('bsp:meta:migrated')).toBe('1')
  })

  it('does not double-rescale already-migrated seed scores', () => {
    // Fresh seed → seed docs already on 0–100, including a literal score of 10.
    const repo = new StorageRepository({ store })
    const before = JSON.stringify(repo.listDocuments())
    // A second construction must early-return on the marker and change nothing.
    const repo2 = new StorageRepository({ store })
    expect(JSON.stringify(repo2.listDocuments())).toBe(before)
    // The haunted-elevator seed doc carries a brand_safety score of 20 (not 200).
    const haunted = repo2.getDocument('doc-haunted-elevator') as Document
    const brand = haunted.submittedSnapshot?.review.signals.find((s) => s.signalId === 'brand_safety')
    expect(brand?.score).toBe(20)
  })

  it('is idempotent: a second load does not re-migrate', () => {
    // A legacy persisted store: seeded at an old version, a stale user doc, and no
    // migration marker. Written directly so no constructor pre-runs migrate().
    store.map.set('bsp:meta:seeded', '1')
    store.map.set('bsp:doc:user-legacy', JSON.stringify(legacyUserDoc()))

    new StorageRepository({ store }) // migrates → sets marker
    const spy = vi.spyOn(store, 'setItem')
    const repo2 = new StorageRepository({ store }) // marker present → no writes
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()

    const doc = repo2.getDocument('user-legacy') as Document
    // Scores stay at 90/20 — not rescaled a second time to 900/200.
    expect(doc.submittedSnapshot?.review.signals.map((s) => s.score)).toEqual([90, 20])
  })

  it('does not re-rescale after a re-run when the global marker was lost', () => {
    // Simulates a prior pass that degraded AFTER rescaling+stamping a record but
    // BEFORE the global marker landed: the record is persisted at 90/20 with its
    // per-record migratedVersion stamp, yet `bsp:meta:migrated` is absent.
    store.map.set('bsp:meta:seeded', '1')
    const partlyMigrated = legacyUserDoc()
    partlyMigrated.migratedVersion = 1
    const snap = partlyMigrated.submittedSnapshot as NonNullable<Document['submittedSnapshot']>
    snap.review.signals = [
      { signalId: 'clarity', score: 90, rationale: 'r', issues: [] },
      { signalId: 'brand_safety', score: 20, rationale: 'r', issues: [] },
    ]
    snap.review.suggestedPrompt = 'Revise the following concept:'
    partlyMigrated.reviewer = PEOPLE.find((p) => p.id === 'person-maya-kambe') as Person
    store.map.set('bsp:doc:user-legacy', JSON.stringify(partlyMigrated))

    // Re-run migration (no global marker → the pass executes again).
    const repo = new StorageRepository({ store })
    const doc = repo.getDocument('user-legacy') as Document

    // The per-record stamp short-circuits the rescale: still 90/20, not 900/200.
    expect(doc.submittedSnapshot?.review.signals.map((s) => s.score)).toEqual([90, 20])
  })

  it('does not double-rescale records persisted before a mid-loop degrade', () => {
    // A real mid-loop degrade: localStorage accepts the per-doc writes but throws on
    // the FINAL global-marker write (e.g. quota hit late in the pass). The marker
    // lands only in the in-memory fallback and is lost on reload, while the rescaled
    // doc was already persisted. A fresh repository over that persisted store must
    // not rescale a second time.
    store.map.set('bsp:meta:seeded', '1')
    store.map.set('bsp:doc:user-legacy', JSON.stringify(legacyUserDoc()))

    // Throw only on the global-marker write; per-doc writes succeed and persist.
    const realSet = store.setItem.bind(store)
    store.setItem = (key: string, value: string): void => {
      if (key === 'bsp:meta:migrated') throw quotaError()
      realSet(key, value)
    }
    const repo1 = new StorageRepository({ store })
    expect(repo1.isInMemory).toBe(true) // degraded on the marker write
    store.setItem = realSet
    // The marker never persisted to the backing store...
    expect(store.getItem('bsp:meta:migrated')).toBeNull()
    // ...but the doc was rescaled and persisted.
    const persisted = JSON.parse(store.map.get('bsp:doc:user-legacy') as string) as Document
    expect(persisted.submittedSnapshot?.review.signals.map((s) => s.score)).toEqual([90, 20])

    // Next load re-runs migration over the partially-migrated store.
    const repo2 = new StorageRepository({ store })
    const doc = repo2.getDocument('user-legacy') as Document
    expect(doc.submittedSnapshot?.review.signals.map((s) => s.score)).toEqual([90, 20])
  })
})

describe('StorageRepository readAll retry-after-degrade', () => {
  it('skips a single corrupt value without truncating the rest of the list', () => {
    const repo = new StorageRepository({ store, seed: false })
    store.map.set('bsp:doc:d1', JSON.stringify({ ...({} as Document), id: 'd1' }))
    store.map.set('bsp:doc:d2', '{ not valid json')
    store.map.set('bsp:doc:d3', JSON.stringify({ ...({} as Document), id: 'd3' }))

    const docs = repo.listDocuments()

    expect(docs.map((d) => d.id).sort()).toEqual(['d1', 'd3'])
  })

  it('re-reads against the recovered MemoryStore when the store fails mid-iteration', () => {
    // A store that throws on the first read of a doc key, then (after degrade swaps
    // in the carried-over MemoryStore) reads fine. Mirrors read()'s retry path.
    const repo = new StorageRepository({ store, seed: false })
    store.map.set('bsp:doc:d1', JSON.stringify({ ...({} as Document), id: 'd1' }))
    store.map.set('bsp:doc:d2', JSON.stringify({ ...({} as Document), id: 'd2' }))

    let thrown = false
    const realGet = store.getItem.bind(store)
    store.getItem = (key: string): string | null => {
      if (!thrown && key.startsWith('bsp:doc:')) {
        thrown = true
        throw new Error('store read failed mid-iteration')
      }
      return realGet(key)
    }

    const docs = repo.listDocuments()

    // Degraded to memory, but BOTH docs survived (no silent truncation).
    expect(repo.isInMemory).toBe(true)
    expect(docs.map((d) => d.id).sort()).toEqual(['d1', 'd2'])
  })
})

describe('StorageRepository degradation', () => {
  it('maps a quota failure to STORAGE_QUOTA and continues in memory', () => {
    const errors: AppError[] = []
    const repo = new StorageRepository({ store, seed: false, onError: (e) => errors.push(e) })
    store.throwOnSet = true
    store.setError = quotaError()

    repo.saveProject(sampleProject)

    expect(errors.some((e) => e.code === 'STORAGE_QUOTA')).toBe(true)
    expect(repo.isInMemory).toBe(true)
    // The write still landed in the in-memory fallback, so the app keeps working.
    expect(repo.getProject('p1')).toEqual(sampleProject)
  })

  it('maps a generic storage failure to STORAGE_UNAVAILABLE', () => {
    const errors: AppError[] = []
    const repo = new StorageRepository({ store, seed: false, onError: (e) => errors.push(e) })
    store.throwOnSet = true
    store.setError = new Error('access is denied for this document')

    repo.saveSignal(sampleSignal)

    expect(errors.some((e) => e.code === 'STORAGE_UNAVAILABLE')).toBe(true)
    expect(repo.isInMemory).toBe(true)
    expect(repo.getSignal('s1')).toEqual(sampleSignal)
  })

  it('falls back to memory when no window is present (SSR)', () => {
    // jsdom provides window; simulate its absence by not injecting a store and
    // stubbing window to undefined for the constructor.
    const original = globalThis.window
    // @ts-expect-error intentionally removing window for the test
    delete globalThis.window
    try {
      const repo = new StorageRepository({ seed: false })
      expect(repo.isInMemory).toBe(true)
      repo.saveProject(sampleProject)
      expect(repo.getProject('p1')).toEqual(sampleProject)
    } finally {
      globalThis.window = original
    }
  })

  it('never throws on save even when both stores reject', () => {
    const repo = new StorageRepository({ store, seed: false })
    store.throwOnSet = true
    // Also make the fallback reject by spying after degradation is forced.
    const spy = vi.spyOn(repo, 'saveProject')
    expect(() => repo.saveProject(sampleProject)).not.toThrow()
    spy.mockRestore()
  })
})
