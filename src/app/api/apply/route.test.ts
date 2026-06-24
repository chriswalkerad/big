import { describe, expect, it } from 'vitest'
import { POST } from './route'
import { seedDocuments, seedProject } from '@/lib/seed-data'

function postRequest(body: string): Request {
  return new Request('http://localhost/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('POST /api/apply route', () => {
  it('returns ok:true with a rewritten text for a valid request (mock provider)', async () => {
    const original = seedDocuments[0].body
    const body = JSON.stringify({
      text: original,
      instruction: 'Tighten the opening for clarity.',
      project: seedProject,
    })
    const res = await POST(postRequest(body))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data.text).toBe('string')
    expect(json.data.text).not.toBe(original)
  })

  it('returns EMPTY_DOC for whitespace-only text', async () => {
    const body = JSON.stringify({ text: '   ', instruction: 'Improve it.', project: seedProject })
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
