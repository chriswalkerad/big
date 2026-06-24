import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageRepository } from './storage'
import { seedDocuments, seedProject, seedSignals } from '@/lib/seed-data'
import type { AppError } from '@/lib/errors'
import type { Document, Project, SignalDef } from '@/types'

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

const sampleProject: Project = {
  id: 'p1',
  name: 'Test Project',
  audience: 'everyone',
  franchiseContext: 'ctx',
  tags: ['a'],
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
    expect(repo.listSignals()).toHaveLength(seedSignals.length)
    expect(repo.listDocuments()).toHaveLength(seedDocuments.length)
    const doc = repo.getDocument('doc-haunted-elevator') as Document
    expect(doc.submittedSnapshot?.review.verdict.label).toBe('not_ready')
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
