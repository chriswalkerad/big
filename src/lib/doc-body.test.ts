import { describe, it, expect } from 'vitest'
import { htmlToText, textToHtml } from './doc-body'

describe('htmlToText', () => {
  it('passes through already-plain text', () => {
    expect(htmlToText('Just a plain sentence.')).toBe('Just a plain sentence.')
  })

  it('strips a single paragraph wrapper', () => {
    expect(htmlToText('<p>Hello world</p>')).toBe('Hello world')
  })

  it('turns multiple paragraphs into newline-separated text', () => {
    expect(htmlToText('<p>First.</p><p>Second.</p>')).toBe('First.\nSecond.')
  })

  it('converts <br> to a newline', () => {
    expect(htmlToText('<p>Line one<br>Line two</p>')).toBe('Line one\nLine two')
  })

  it('decodes common HTML entities', () => {
    expect(htmlToText('<p>Tom &amp; Jerry &lt;3</p>')).toBe('Tom & Jerry <3')
    expect(htmlToText("<p>It&#39;s fine</p>")).toBe("It's fine")
  })

  it('handles the empty-paragraph case', () => {
    expect(htmlToText('<p></p>')).toBe('')
  })
})

describe('textToHtml', () => {
  it('wraps a single line in a paragraph', () => {
    expect(textToHtml('Hello world')).toBe('<p>Hello world</p>')
  })

  it('wraps each line in its own paragraph', () => {
    expect(textToHtml('First.\nSecond.')).toBe('<p>First.</p><p>Second.</p>')
  })

  it('escapes HTML-special characters', () => {
    expect(textToHtml('Tom & Jerry <3')).toBe('<p>Tom &amp; Jerry &lt;3</p>')
  })

  it('returns empty string for blank input', () => {
    expect(textToHtml('')).toBe('')
    expect(textToHtml('   ')).toBe('')
  })
})

describe('round-trip', () => {
  it('text -> html -> text is stable for plain bodies', () => {
    const text = 'Eloise runs a midnight room-service caper.'
    expect(htmlToText(textToHtml(text))).toBe(text)
  })

  it('preserves paragraph breaks across a round-trip', () => {
    const text = 'First paragraph.\nSecond paragraph.'
    expect(htmlToText(textToHtml(text))).toBe(text)
  })
})
