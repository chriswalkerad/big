import { describe, expect, it } from 'vitest'
import { POST } from './route'
import { seedDocuments, seedProject, seedSignals } from '@/lib/seed-data'

function postRequest(body: string): Request {
  return new Request('http://localhost/api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('POST /api/review route', () => {
  it('returns ok:true with a ReviewResult for a valid request (mock provider)', async () => {
    const body = JSON.stringify({ text: seedDocuments[0].body, project: seedProject, signals: seedSignals })
    const res = await POST(postRequest(body))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.signals).toHaveLength(seedSignals.length)
  })

  it('returns EMPTY_DOC for whitespace-only text', async () => {
    const body = JSON.stringify({ text: '   ', project: seedProject, signals: seedSignals })
    const res = await POST(postRequest(body))
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('EMPTY_DOC')
  })

  it('returns a typed error (400) for a malformed JSON body', async () => {
    const res = await POST(postRequest('{ not json'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('UNKNOWN')
  })
})
