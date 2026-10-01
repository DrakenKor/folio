// One triangle that covers the screen, built from the vertex index alone
export const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vUv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}
`

// Shadertoy's inputs, declared ahead of the visitor's source
const PREAMBLE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
out vec4 shaderColor;
`

const EPILOGUE = `
void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  shaderColor = vec4(color.rgb, 1.0);
}
`

const PREAMBLE_LINES = PREAMBLE.split('\n').length - 1

// A complete fragment shader around a source that defines mainImage
export const wrapSource = (source: string): string => PREAMBLE + source + EPILOGUE

export interface ShaderError {
  // 1-based line in the visitor's source, or null when the driver names none
  line: number | null
  message: string
}

// "ERROR: 0:15: 'x' : undeclared identifier"
const ERROR_ROW = /ERROR:\s*\d+:(\d+):\s*(.*)/

/**
 * The driver's info log, with each line number moved back from the wrapped
 * shader to the source the visitor typed.
 */
export function translateErrors(log: string, source: string): ShaderError[] {
  const lines = source.split('\n').length
  const errors: ShaderError[] = []
  for (const row of log.split('\n')) {
    const match = ERROR_ROW.exec(row)
    if (!match) continue
    const line = Number(match[1]) - PREAMBLE_LINES
    errors.push({ line: line >= 1 && line <= lines ? line : null, message: match[2].trim() })
  }
  const text = log.replace(/\0/g, '').trim()
  if (!errors.length && text) errors.push({ line: null, message: text })
  return errors
}

export type ShaderControl =
  | { kind: 'slider'; name: string; min: number; max: number; default: number }
  | { kind: 'color'; name: string; default: [number, number, number] }
  | { kind: 'toggle'; name: string; default: boolean }

// One regular expression per annotation. The comment must share the
// uniform's line.
const NUMBER = '(-?(?:\\d+\\.?\\d*|\\.\\d+))'
const THREE = `${NUMBER}[ \\t]+${NUMBER}[ \\t]+${NUMBER}[ \\t]*$`
const SLIDER = new RegExp(`uniform[ \\t]+float[ \\t]+(\\w+)[ \\t]*;[ \\t]*//[ \\t]*@slider[ \\t]+${THREE}`, 'gm')
const COLOR = new RegExp(`uniform[ \\t]+vec3[ \\t]+(\\w+)[ \\t]*;[ \\t]*//[ \\t]*@color[ \\t]+${THREE}`, 'gm')
const TOGGLE = /uniform[ \t]+bool[ \t]+(\w+)[ \t]*;[ \t]*\/\/[ \t]*@toggle[ \t]+(true|false)[ \t]*$/gm

/**
 * The controls a source asks for, in the order it declares them. A uniform
 * with no annotation, or a malformed one, gets none.
 */
export function parseControls(source: string): ShaderControl[] {
  const found: { index: number; control: ShaderControl }[] = []
  for (const match of source.matchAll(SLIDER)) {
    const [min, max, value] = match.slice(2).map(Number)
    if (max <= min) continue
    const control: ShaderControl = { kind: 'slider', name: match[1], min, max, default: Math.min(max, Math.max(min, value)) }
    found.push({ index: match.index, control })
  }
  for (const match of source.matchAll(COLOR)) {
    const [r, g, b] = match.slice(2).map(Number)
    found.push({ index: match.index, control: { kind: 'color', name: match[1], default: [r, g, b] } })
  }
  for (const match of source.matchAll(TOGGLE)) {
    found.push({ index: match.index, control: { kind: 'toggle', name: match[1], default: match[2] === 'true' } })
  }
  const seen = new Set<string>()
  return found
    .sort((a, b) => a.index - b.index)
    .map(item => item.control)
    .filter(control => !seen.has(control.name) && seen.add(control.name))
}

// The longest encoded source a share link will carry
export const SHARE_LIMIT = 8192

const pump = async (bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) => {
  const writer = stream.writable.getWriter()
  // Errors surface on the reading side; these two only must not go unhandled
  writer.write(bytes).catch(() => {})
  writer.close().catch(() => {})
  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.length
  }
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

// Source to deflate-raw to base64url: what goes after "#s=" in a share link
export async function encodeShare(source: string): Promise<string> {
  const bytes = await pump(new TextEncoder().encode(source), new CompressionStream('deflate-raw'))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Throws if the text is over the limit or is not a share link's payload
export async function decodeShare(encoded: string): Promise<string> {
  if (encoded.length > SHARE_LIMIT) throw new Error('Share link too long')
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const source = await pump(bytes, new DecompressionStream('deflate-raw'))
  return new TextDecoder('utf-8', { fatal: true }).decode(source)
}
