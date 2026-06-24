// Client-side data layer. Components NEVER touch localStorage directly — they go
// through a StorageRepository. Keys are namespaced (bsp:project:<id>, bsp:doc:<id>,
// bsp:signal:<id>, bsp:meta:*). On first run (empty store) it seeds from
// @/lib/seed-data. Storage failures are caught and mapped to STORAGE_UNAVAILABLE /
// STORAGE_QUOTA; the repository then continues entirely in memory for the session so
// the app never crashes. Safe to construct on the client (and during SSR, where it
// runs in-memory-only). See specs/bsp-backend-build-spec.md.

import type { Document, Project, SignalDef } from '@/types'
import { type AppError, appError, toAppError } from '@/lib/errors'
import { seedDocuments, seedProjects, seedSignals } from '@/lib/seed-data'

const NS = 'bsp'
const KEY = {
  project: (id: string) => `${NS}:project:${id}`,
  doc: (id: string) => `${NS}:doc:${id}`,
  signal: (id: string) => `${NS}:signal:${id}`,
  seeded: `${NS}:meta:seeded`,
} as const

const PREFIX = {
  project: `${NS}:project:`,
  doc: `${NS}:doc:`,
  signal: `${NS}:signal:`,
} as const

/** Minimal storage surface, so the in-memory fallback can stand in for the real one. */
interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

/** In-memory store used when localStorage is unavailable or has failed. */
class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
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

export interface StorageRepositoryOptions {
  /** Inject a store (tests). Defaults to window.localStorage when available. */
  store?: KeyValueStore
  /** Called whenever a storage operation degrades (e.g. quota, unavailable). */
  onError?: (error: AppError) => void
  /** Skip first-run seeding (tests). */
  seed?: boolean
}

export class StorageRepository {
  private store: KeyValueStore
  private degraded = false
  private readonly onError?: (error: AppError) => void

  constructor(options: StorageRepositoryOptions = {}) {
    this.onError = options.onError
    this.store = options.store ?? this.resolveStore()
    if (options.seed !== false) {
      this.seedIfEmpty()
    }
  }

  /** True once the repository has fallen back to in-memory storage. */
  get isInMemory(): boolean {
    return this.degraded
  }

  // --- Project ---------------------------------------------------------------

  getProject(id: string): Project | null {
    return this.read<Project>(KEY.project(id))
  }
  listProjects(): Project[] {
    return this.readAll<Project>(PREFIX.project)
  }
  saveProject(project: Project): void {
    this.write(KEY.project(project.id), project)
  }
  removeProject(id: string): void {
    this.delete(KEY.project(id))
  }

  // --- Document --------------------------------------------------------------

  getDocument(id: string): Document | null {
    return this.read<Document>(KEY.doc(id))
  }
  listDocuments(): Document[] {
    return this.readAll<Document>(PREFIX.doc)
  }
  saveDocument(doc: Document): void {
    this.write(KEY.doc(doc.id), doc)
  }
  removeDocument(id: string): void {
    this.delete(KEY.doc(id))
  }

  // --- Signal ----------------------------------------------------------------

  getSignal(id: string): SignalDef | null {
    return this.read<SignalDef>(KEY.signal(id))
  }
  listSignals(): SignalDef[] {
    return this.readAll<SignalDef>(PREFIX.signal)
  }
  saveSignal(signal: SignalDef): void {
    this.write(KEY.signal(signal.id), signal)
  }
  removeSignal(id: string): void {
    this.delete(KEY.signal(id))
  }

  // --- Internals -------------------------------------------------------------

  private resolveStore(): KeyValueStore {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Probe access; some environments throw on touch (private mode, blocked).
        const probe = `${NS}:meta:probe`
        window.localStorage.setItem(probe, '1')
        window.localStorage.removeItem(probe)
        return window.localStorage
      }
    } catch (e) {
      this.degrade(toAppError(e))
    }
    // No window (SSR) or access denied: run in memory for this session.
    this.degraded = true
    return new MemoryStore()
  }

  private degrade(error: AppError): void {
    if (!this.degraded) {
      this.degraded = true
      // Preserve anything already written this session.
      const carry = new MemoryStore()
      try {
        for (let i = 0; i < this.store.length; i++) {
          const k = this.store.key(i)
          if (k) {
            const v = this.store.getItem(k)
            if (v !== null) carry.setItem(k, v)
          }
        }
      } catch {
        // Best-effort; if we can't read the old store, start clean in memory.
      }
      this.store = carry
    }
    this.onError?.(error)
  }

  private read<T>(key: string): T | null {
    try {
      const raw = this.store.getItem(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch (e) {
      // Read/parse failure on one key shouldn't crash; degrade and retry in memory.
      this.degrade(toAppError(e))
      try {
        const raw = this.store.getItem(key)
        return raw === null ? null : (JSON.parse(raw) as T)
      } catch {
        return null
      }
    }
  }

  private readAll<T>(prefix: string): T[] {
    const out: T[] = []
    try {
      for (let i = 0; i < this.store.length; i++) {
        const k = this.store.key(i)
        if (k && k.startsWith(prefix)) {
          const raw = this.store.getItem(k)
          if (raw !== null) out.push(JSON.parse(raw) as T)
        }
      }
    } catch (e) {
      this.degrade(toAppError(e))
    }
    return out
  }

  private write<T>(key: string, value: T): void {
    const payload = JSON.stringify(value)
    try {
      this.store.setItem(key, payload)
    } catch (e) {
      // Quota or availability failure: map it, degrade to memory, and retry there so
      // the in-session write still succeeds and the app keeps working.
      this.degrade(this.mapStorageError(e))
      try {
        this.store.setItem(key, payload)
      } catch {
        // Even the memory store rejected it — nothing more we can do safely.
      }
    }
  }

  private delete(key: string): void {
    try {
      this.store.removeItem(key)
    } catch (e) {
      this.degrade(toAppError(e))
      try {
        this.store.removeItem(key)
      } catch {
        // ignore
      }
    }
  }

  /** Distinguish a full store (quota) from a generally unavailable one. */
  private mapStorageError(e: unknown): AppError {
    const name = e instanceof Error ? e.name : ''
    const message = e instanceof Error ? e.message : String(e)
    if (
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      /quota|exceeded the quota/i.test(message)
    ) {
      return appError('STORAGE_QUOTA', message, e)
    }
    const mapped = toAppError(e)
    if (mapped.code === 'STORAGE_QUOTA' || mapped.code === 'STORAGE_UNAVAILABLE') return mapped
    return appError('STORAGE_UNAVAILABLE', message, e)
  }

  private seedIfEmpty(): void {
    try {
      if (this.store.getItem(KEY.seeded) === '1') return
      const empty =
        this.listProjects().length === 0 &&
        this.listDocuments().length === 0 &&
        this.listSignals().length === 0
      if (empty) {
        for (const project of seedProjects) this.saveProject(project)
        for (const signal of seedSignals) this.saveSignal(signal)
        for (const doc of seedDocuments) this.saveDocument(doc)
      }
      // Plain marker (not JSON) so the early-return check above can compare it.
      this.writeRaw(KEY.seeded, '1')
    } catch (e) {
      // Seeding must never crash the app; degrade and keep going.
      this.degrade(toAppError(e))
    }
  }

  /** Write a raw string value (used for meta markers, not JSON-encoded entities). */
  private writeRaw(key: string, value: string): void {
    try {
      this.store.setItem(key, value)
    } catch (e) {
      this.degrade(this.mapStorageError(e))
      try {
        this.store.setItem(key, value)
      } catch {
        // ignore
      }
    }
  }
}

/** Build the default repository (browser/localStorage with first-run seeding). */
export function createStorageRepository(options?: StorageRepositoryOptions): StorageRepository {
  return new StorageRepository(options)
}
