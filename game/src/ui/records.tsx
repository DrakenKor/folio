import { useRef, useState } from 'react'
import type { SaveController, SaveResult, SaveStatus, SaveStatusCode } from '../platform/saves'

const messages: Record<SaveStatusCode, [string, string]> = {
  ready: ['Local save ready', 'This tab can save your character.'],
  blocked: ['Open in another tab', 'Play here to load the latest local character and move play to this tab.'],
  'lost-writer': ['Play moved to another tab', 'This clearing is paused. Play here to resume from the latest save.'],
  'generation-mismatch': ['A newer save is available', 'Play here to resume from the latest local character.'],
  'read-only': ['Read-only session', 'Web Locks are unavailable. Copy save text before leaving, then paste it to resume.'],
  quota: ['Save failed · storage full', 'Your previous save is intact. Copy save text to keep this character.'],
  security: ['Browser storage denied', 'Copy save text to keep your progress outside this browser.'],
  'read-failed': ['Local save unavailable', 'The browser could not read your save. Copy save text or retry loading.'],
  corrupt: ['Corrupt save text', 'Check the text and import again. Your local save is preserved.'],
  'future-schema': ['Newer save format', 'Use a compatible version or import another save. Stored text is preserved.'],
  'invalid-character': ['Invalid character data', 'Check the character text and import again.'],
  oversize: ['Save exceeds 1 MiB', 'Choose a smaller, complete character record to import.'],
  unsupported: ['Character unavailable', 'Open a clearing with a character to use saves.']
}
export const recordTitle = (code: SaveStatusCode) => messages[code][0]
export const locked = (s: SaveStatusCode) => ['blocked', 'lost-writer', 'generation-mismatch'].includes(s)
export type RecordMode = 'status' | 'export' | 'import' | 'reset'

export function Records({ saves, status, mode, change, updated }: {
  saves: SaveController; status: SaveStatus; mode: RecordMode; change: (m: RecordMode) => void; updated: () => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const unchecked = status.code === 'blocked' && status.generation === 0
  const [title, advice] = unchecked ? ['Check local save access', 'Load save to open your character. If it is open in another tab, Play here transfers control.'] : messages[status.code]
  const run = async (op: () => Promise<SaveResult>, success: string) => {
    setBusy(true)
    try {
      const r = await op()
      change('status'); setMessage(r.ok ? success : messages[r.reason][0]); updated()
    } finally { setBusy(false) }
  }
  let text = ''
  if (mode === 'export') { try { text = saves.export() } catch { text = status.text ?? '' } }
  function choose(m: RecordMode) { setMessage(''); change(m) }
  return <div className="record-layout"><div className="record-mark" aria-hidden="true"><svg viewBox="0 0 160 200">
    <path d="M80 12L106 49L80 88L54 49ZM80 12V88M54 49H106M48 108L80 87L112 108L119 157L80 182L41 157ZM48 108L80 128L112 108M80 128V182M56 141L69 150M91 150L104 141M32 166L80 194L128 166"/></svg></div>
    <div className="record-copy"><small>Character record · Generation {status.generation}</small>
      <h2>{mode === 'import' ? 'Import character' : mode === 'reset' ? 'Reset character?' : mode === 'export' ? 'Copy save text' : title}</h2>
      <p>{mode === 'reset' ? 'Replace this character with a fresh rank 1 build. Copy save text first to keep a backup.' :
        mode === 'import' ? 'Paste the complete save text. Import replaces your current character.' : mode === 'export' ? 'Keep this text to restore your equipment, folds and passive lattice.' : advice}</p>
      {status.refunds.length > 0 && <ul>{status.refunds.map((r,i) => <li key={i}>{r}</li>)}</ul>}
      {(mode === 'import' || mode === 'export') && <textarea key={mode} ref={input} aria-label="Character save text" spellCheck={false} readOnly={mode === 'export'}
        defaultValue={mode === 'export' ? text : ''} onFocus={e => { if (mode === 'export') e.target.select() }}/>}
      {message && <p role="status" className="response">{message}</p>}
      <div className="record-buttons"><fieldset disabled={busy}>
      {mode === 'status' && <>
        {unchecked && <button className="primary" onClick={() => run(() => saves.load(), 'Local save checked')}>Load save</button>}
        {locked(status.code) ? <button className={unchecked ? '' : 'primary'} onClick={() => run(() => saves.takeOver(), 'Takeover complete. Latest character loaded.')}>Play here</button> :
        status.writable && <button className="primary" onClick={() => run(() => saves.flush(), 'Character saved')}>Save now</button>}
        <button onClick={() => choose('export')}>Copy save text</button><button disabled={locked(status.code)} onClick={() => choose('import')}>Paste save</button>
        {!unchecked && <button onClick={() => run(() => saves.load(), 'Local save checked')}>Load save</button>}<button disabled={locked(status.code)} onClick={() => choose('reset')}>Reset</button></>}
      {mode === 'export' && <><button className="primary" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setMessage('Save text copied') }
        catch { input.current?.focus(); input.current?.select(); setMessage('Text selected. Use the browser Copy command.') }
      }}>Copy to clipboard</button><button disabled={locked(status.code)} onClick={() => choose('import')}>Paste save</button></>}
      {mode === 'import' && <button className="primary" onClick={() => run(() => saves.import(input.current?.value ?? ''), 'Character imported')}>Import</button>}
      {mode === 'reset' && <button className="primary" onClick={() => run(() => saves.reset(), 'Character reset to rank 1')}>Confirm</button>}
      {mode !== 'status' && <button onClick={() => choose('status')}>Back</button>}</fieldset></div>
    </div></div>
}
