'use client'

import { KeyboardEvent, useMemo, useRef } from 'react'

type Tone = 'comment' | 'word' | 'number'

interface Token {
  text: string
  tone?: Tone
}

const WORDS = [
  'void', 'bool', 'int', 'uint', 'float', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4',
  'bvec2', 'bvec3', 'bvec4', 'mat2', 'mat3', 'mat4', 'sampler2D', 'uniform', 'const', 'in', 'out',
  'inout', 'if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue', 'discard', 'struct',
  'precision', 'highp', 'mediump', 'lowp', 'true', 'false'
]

// Three tones and no more: comments, types and keywords, numbers
const TOKENS = new RegExp(
  [
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
    `(#\\w+|\\b(?:${WORDS.join('|')})\\b)`,
    '((?:\\b\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?[fFuU]?)'
  ].join('|'),
  'g'
)

// The source as lines of toned tokens
export function highlight(source: string): Token[][] {
  const lines: Token[][] = [[]]
  const push = (text: string, tone?: Tone) => {
    // A block comment can span lines; every line keeps its own tokens
    text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ text: part, tone })
    })
  }
  let last = 0
  for (const match of source.matchAll(TOKENS)) {
    push(source.slice(last, match.index))
    push(match[0], match[1] ? 'comment' : match[2] ? 'word' : 'number')
    last = match.index + match[0].length
  }
  push(source.slice(last))
  return lines
}

interface EditorProps {
  value: string
  // Names the textarea for assistive technology
  label: string
  onChange?: (value: string) => void
  // Cmd or Ctrl with Enter, or with S
  onCompile?: () => void
  readOnly?: boolean
  // 1-based lines to underline
  errorLines?: number[]
  describedBy?: string
}

/**
 * A textarea over a coloured copy of its own text. The two share font metrics
 * and one scrolling parent, so the caret sits on the coloured glyphs.
 */
export function Editor({ value, label, onChange, onCompile, readOnly, errorLines, describedBy }: EditorProps) {
  const lines = useMemo(() => highlight(value), [value])
  // Tab indents, which would trap a keyboard. Escape lets the next Tab out.
  const escaped = useRef(false)

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const area = event.currentTarget
    if ((event.metaKey || event.ctrlKey) && (event.key === 'Enter' || event.key.toLowerCase() === 's')) {
      event.preventDefault()
      onCompile?.()
      return
    }
    if (event.key === 'Tab') {
      const leave = escaped.current || readOnly || event.shiftKey
      escaped.current = false
      if (leave) return
      event.preventDefault()
      // insertText keeps the browser's undo history; setRangeText is the fallback
      if (!document.execCommand('insertText', false, '  ')) {
        area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end')
        onChange?.(area.value)
      }
      return
    }
    if (event.key !== 'Shift') escaped.current = event.key === 'Escape'
  }

  return (
    <div className="shader-editor" data-readonly={readOnly ? 'true' : 'false'}>
      <div className="shader-editor-sheet">
        <pre className="shader-editor-code" aria-hidden="true">
          {lines.map((tokens, index) => (
            <span
              key={index}
              className="shader-editor-line"
              data-error={errorLines?.includes(index + 1) ? 'true' : undefined}>
              <span>
                {tokens.map((token, at) =>
                  token.tone ? (
                    <span key={at} className={`shader-tone-${token.tone}`}>
                      {token.text}
                    </span>
                  ) : (
                    token.text
                  )
                )}
              </span>
            </span>
          ))}
        </pre>
        <textarea
          className="shader-editor-input"
          aria-label={label}
          aria-describedby={describedBy}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          onChange={event => onChange?.(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  )
}
