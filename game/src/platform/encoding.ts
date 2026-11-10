/** Gzip UTF-8 text for shareable fragments and bug-report replays. */
export async function encode(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export async function decode(text: string): Promise<string> {
  if (!/^[\w-]+$/.test(text)) throw new TypeError('Expected gzipped base64url text')
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
}
