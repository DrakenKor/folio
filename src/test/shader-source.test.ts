import { describe, expect, it } from 'vitest'
import { SHARE_LIMIT, decodeShare, encodeShare, parseControls, translateErrors, wrapSource } from '../lib/shader-source'
import sample from './fixtures/shadertoy-sample.glsl'

describe('shader-source', () => {
  it('wraps a mainImage source so that error lines map back to the original', () => {
    const wrapped = wrapSource(sample)
    expect(wrapped.startsWith('#version 300 es\n')).toBe(true)
    expect(wrapped).toContain('uniform vec4 iMouse;')
    expect(wrapped).toMatch(/void main\(\) \{[\s\S]*mainImage\(color, gl_FragCoord\.xy\)/)

    // The driver numbers lines of the wrapped shader, from 1
    const lineOf = (text: string, needle: string) => text.split('\n').findIndex(row => row.includes(needle)) + 1
    const original = lineOf(sample, 'float radius = length(uv);')
    const log = [
      `ERROR: 0:${lineOf(wrapped, 'float radius = length(uv);')}: 'lenght' : no matching overloaded function found`,
      `ERROR: 0:${wrapped.split('\n').length - 2}: 'mainImage' : no matching overloaded function found`,
      ''
    ].join('\n')

    expect(original).toBeGreaterThan(1)
    expect(translateErrors(`Shader compilation failed: ${log}`, sample)).toEqual([
      { line: original, message: "'lenght' : no matching overloaded function found" },
      // An error in the lines the page adds has no line of the visitor's to point at
      { line: null, message: "'mainImage' : no matching overloaded function found" }
    ])
    expect(translateErrors('Program linking failed: bad varyings\0', sample)).toEqual([
      { line: null, message: 'Program linking failed: bad varyings' }
    ])
  })

  it('parses each annotation type to the right control and default', () => {
    const source = [
      'uniform float drift;  // @slider 0 2 0.4',
      'uniform vec3 tint;    // @color 0.82 .5 1',
      'uniform bool invert;  // @toggle true',
      'uniform float plain;',
      'void mainImage(out vec4 c, in vec2 p) { c = vec4(tint * drift, 1.0); }'
    ].join('\n')

    expect(parseControls(source)).toEqual([
      { kind: 'slider', name: 'drift', min: 0, max: 2, default: 0.4 },
      { kind: 'color', name: 'tint', default: [0.82, 0.5, 1] },
      { kind: 'toggle', name: 'invert', default: true }
    ])
  })

  it('ignores malformed annotations without throwing', () => {
    const source = [
      'uniform float a; // @slider 0 2',
      'uniform float b; // @slider 2 0 1',
      'uniform float c; // @slider zero one half',
      'uniform vec3 d; // @slider 0 1 0.5',
      'uniform bool e; // @toggle maybe',
      'uniform float f; // @color 1 1 1',
      'uniform float g;',
      '// @slider 0 1 0.5',
      'uniform float h; // @slider 0 1 7'
    ].join('\n')

    // Only the last is well formed; its default is pulled into range
    expect(parseControls(source)).toEqual([{ kind: 'slider', name: 'h', min: 0, max: 1, default: 1 }])
    expect(parseControls('')).toEqual([])
  })

  it('round-trips a source through the share encoding', async () => {
    const encoded = await encodeShare(sample)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encoded.length).toBeLessThan(sample.length)
    expect(encoded.length).toBeLessThanOrEqual(SHARE_LIMIT)
    expect(await decodeShare(encoded)).toBe(sample)

    expect(await decodeShare(await encodeShare('vec3 café = vec3(1.0); // ◆'))).toBe('vec3 café = vec3(1.0); // ◆')
    await expect(decodeShare('not a share link')).rejects.toThrow()
    await expect(decodeShare('A'.repeat(SHARE_LIMIT + 1))).rejects.toThrow()
  })
})
