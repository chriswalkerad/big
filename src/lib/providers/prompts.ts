// Shared prompt builders used by every real review provider. Kept provider-
// agnostic so the system/user prompts stay identical no matter which model
// backs the review. See specs/bsp-backend-build-spec.md.

import type { ApplyInput, ReviewInput } from './interface'

export function buildSystemInstruction(input: ReviewInput): string {
  const { project } = input
  return [
    'You are a creative-development reviewer for a studio. You review a single creative concept against a fixed set of signals and return a structured assessment.',
    '',
    'PROJECT CONTEXT',
    `Name: ${project.name}`,
    `Audience: ${project.audience}`,
    `Tags: ${project.tags.join(', ')}`,
    `Franchise context: ${project.franchiseContext}`,
    '',
    'OUTPUT RULES',
    '- Return JSON only, matching the provided schema exactly. No prose outside the JSON.',
    '- For every signal in the criteria below, return one entry in "signals" whose "signalId" is that signal\'s id.',
    '- Score each signal with an integer from 0 to 100.',
    '- Only signals whose mode is "inline" may include "issues". Doc-mode signals must return an empty "issues" array.',
    '- Each issue\'s "quote" MUST be an EXACT, VERBATIM substring of the concept text below — copy it character-for-character, do not paraphrase, trim, or correct it. If you cannot quote verbatim, omit the issue.',
    '- Brand-safety issues use severity "risk"; clarity/other inline issues use severity "minor".',
    '- "flagCount" is the number of signals scoring below their threshold. Verdict: "looks_ready" if none are below threshold; "not_ready" if any Brand Safety signal is below threshold OR 4+ signals are flagged; otherwise "needs_work".',
    '- "summary": a 1-3 sentence plain-language overview of what the author should do next. Reference the lowest-scoring signals and call out any brand-safety risk specifically. Be concrete and actionable.',
    '- "suggestedPrompt": a ready-to-use revision instruction the author can apply directly to their text in line with this review. Target the weakest signals and instruct the AI to keep audience/format/on-brand details intact. Do NOT append a placeholder or the author\'s text — return ONLY the instruction.',
  ].join('\n')
}

export function buildPrompt(input: ReviewInput): string {
  const { text, signals } = input
  const criteria = signals
    .map(
      (s, i) =>
        `${i + 1}. id="${s.id}" name="${s.name}" mode="${s.mode}" threshold=${s.threshold}\n   prompt: ${s.prompt}`,
    )
    .join('\n')
  return [
    'CONCEPT TEXT (quote exact substrings from here):',
    '"""',
    text,
    '"""',
    '',
    'SIGNAL CRITERIA (return one signal entry per id):',
    criteria,
  ].join('\n')
}

// --- Apply (rewrite) prompt ----------------------------------------------------

/** System instruction for the "apply suggested prompt" plain-text rewrite. */
export function buildApplySystemInstruction(input: ApplyInput): string {
  const { project } = input
  return [
    'You are a script editor. Rewrite the author\'s text to satisfy the instruction. Return ONLY the rewritten text, no preamble or quotes.',
    '',
    'PROJECT CONTEXT',
    `Name: ${project.name}`,
    `Audience: ${project.audience}`,
    `Tags: ${project.tags.join(', ')}`,
    `Franchise context: ${project.franchiseContext}`,
    '',
    'OUTPUT RULES',
    '- Return ONLY the rewritten text. No preamble, no explanation, no surrounding quotes or code fences.',
    '- Preserve the author\'s voice and any details the instruction does not ask you to change.',
    '- Keep it appropriate for the project audience and on-brand for the franchise context.',
  ].join('\n')
}

/** User prompt carrying the instruction and the author's current text. */
export function buildApplyPrompt(input: ApplyInput): string {
  const { text, instruction } = input
  return [
    'INSTRUCTION:',
    instruction,
    '',
    "AUTHOR'S TEXT (rewrite this):",
    '"""',
    text,
    '"""',
  ].join('\n')
}
