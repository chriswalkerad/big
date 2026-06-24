import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the OpenAI SDK so the provider is testable without a network call. The
// constructor just stores options; `chat.completions.create` is the seam.
const createMock = vi.fn()
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } }
  },
}))

import { AzureProvider, DEFAULT_AZURE_DEPLOYMENT } from './azure'
import { seedProject, seedSignals } from '@/lib/seed-data'
import type { ReviewInput } from './interface'
import type { ReviewResult } from '@/types'

const input: ReviewInput = {
  text: 'Eloise runs a secret midnight room-service operation at the Plaza.',
  project: seedProject,
  signals: seedSignals,
}

const validResult: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'Midnight Room Service',
  themes: ['mischief'],
  signals: [{ signalId: 'clarity', score: 8, rationale: 'Clear.', issues: [] }],
  verdict: { label: 'needs_work', flagCount: 1 },
}

describe('AzureProvider', () => {
  beforeEach(() => createMock.mockReset())

  it('defaults the deployment to gpt-5.5', () => {
    expect(DEFAULT_AZURE_DEPLOYMENT).toBe('gpt-5.5')
  })

  it('parses a structured completion into a ReviewResult and sends json_schema output', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validResult) } }] })
    const provider = new AzureProvider('https://r.services.ai.azure.com/openai/v1', 'key', 'gpt-5.5')
    const out = await provider.review(input)
    expect(out).toEqual(validResult)
    const args = createMock.mock.calls[0][0]
    expect(args.model).toBe('gpt-5.5')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
    // The system message carries the shared verbatim-quote rule.
    expect(String(args.messages[0].content).toLowerCase()).toContain('verbatim')
  })

  it('falls back to the default deployment when none is given', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validResult) } }] })
    const provider = new AzureProvider('https://r/openai/v1', 'key')
    await provider.review(input)
    expect(createMock.mock.calls[0][0].model).toBe('gpt-5.5')
  })

  it('maps an empty response to AI_BAD_JSON', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '' } }] })
    const provider = new AzureProvider('https://r/openai/v1', 'key')
    await expect(provider.review(input)).rejects.toMatchObject({ code: 'AI_BAD_JSON' })
  })

  it('maps unparseable content to AI_BAD_JSON', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] })
    const provider = new AzureProvider('https://r/openai/v1', 'key')
    await expect(provider.review(input)).rejects.toMatchObject({ code: 'AI_BAD_JSON' })
  })

  // SDK transport errors (429/5xx/timeout) flow through the catch -> toAppError,
  // whose status mapping (429 -> AI_RATE_LIMIT, 5xx -> AI_UNAVAILABLE, etc.) is
  // covered directly in errors.test.ts. The catch -> toAppError path itself is
  // exercised by the AI_BAD_JSON cases above.
})
