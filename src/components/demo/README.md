# The demo shell

The seven demos under `src/app/(demos)/` share one shell. The route group's
`layout.tsx` renders `<DemoShell>`, which owns the bar (back link, title, seven
pips), the threshold backdrop, the keyboard shortcuts, pause state and the boot
loader. A demo composes the rest from the parts below.

Design tokens and all shell styles live in `src/app/(demos)/demos.css`, scoped
under `.demo-shell`. A demo's own styles go in a CSS file beside its component
(`src/components/demo/<name>/<name>.css`, imported by the component), with every
selector prefixed by the demo's name. Use the tokens; add no colour and no
typeface.

| Token | Use |
| --- | --- |
| `--demo-black` `--demo-white` `--demo-text` | page, titles and active values, body text |
| `--demo-dim` | labels and resting chrome (6.2:1 on black) |
| `--demo-bone` | slider thumbs, default canvas palette (`#d1d1d1`) |
| `--demo-line` | hairlines |
| `--demo-veil` | backing for chrome that floats over a canvas, with `backdrop-filter: blur(12px)`. Dark enough for `--demo-dim` text over a white canvas. |
| `--signal-compiled` (teal) | the compiled path: Rust, WASM, GPU |
| `--signal-interpreted` (amber) | the JavaScript path |
| `--signal-change` (pink) | something changed or failed |
| `--radius-rail` `--radius-control` | the only two radii |
| `--ease` `--dur-quick` `--dur-move` `--dur-fade` | 150 ms hovers, 420 ms moves, 1000 ms for chrome coming up from rest |

Signals are never decoration and always sit beside a text label. The diamond
(`.demo-diamond`) appears in slider thumbs, toggles, pips and the back mark, and
nowhere else in the chrome.

## A page

`page.tsx` is a server component. It exports metadata and renders one client
child:

```tsx
import { Particles } from '@/components/demo/particles/Particles'
import { demoMetadata } from '@/lib/demos'

export const metadata = demoMetadata('particles')

export default function ParticlesPage() {
  return <Particles />
}
```

The shell already renders the page's only `<h1>` (the bar title). Headings in a
demo start at `<h2>`.

## Stage variant

The canvas fills the viewport, chrome floats over it, notes sit below the fold.

```tsx
'use client'

export function Example() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stage = useStage({
    onFrame: ({ time, dt, width, height, ratio, frame }) => {
      // draw; then, once the first real frame is on screen:
      if (frame === 1) stage.ready()
    },
    onInput: input => {
      // input.type: 'down' | 'move' | 'up' | 'wheel' | 'pinch'
    }
  })

  return (
    <>
      <Stage>
        <canvas
          ref={node => {
            canvasRef.current = node
            stage.ref(node)
          }}
          className="demo-canvas"
          aria-label="What the canvas shows"
        />
        <Rail>
          <Slider label="Flow" value={flow} min={0} max={2} step={0.01} defaultValue={0.4} onChange={setFlow} />
        </Rail>
        <Ledger rows={[{ key: 'Frame', value: `${stage.frameMs.toFixed(1)} ms` }]} />
      </Stage>
      <Notes slug="particles">
        <NotesSection title="What you are looking at">
          <p>...</p>
        </NotesSection>
        <NotesSection title="How it works">
          <p>...</p>
        </NotesSection>
        <NotesSource files={['src/components/demo/particles/Particles.tsx']} />
      </Notes>
    </>
  )
}
```

## Scroll variant

A visual stays pinned while a column of text and controls scrolls past. On
phones the visual pins to the top 40% of the viewport.

```tsx
<ScrollLayout visual={<PinnedVisual />}>
  <h2>1 A hash</h2>
  <p>...</p>
</ScrollLayout>
<Notes slug="crypto">...</Notes>
```

A scroll-variant demo has no canvas frame to wait for, so it calls
`useDemoShell().setReady()` in an effect once its first content is up.

## `useDemoShell()`

| Field | Meaning |
| --- | --- |
| `demo` | This page's registry entry from `src/lib/demos.ts` |
| `paused`, `setPaused` | Space toggles it. Starts true under reduced motion. |
| `isReady`, `setReady()` | Call when the first real frame or content is up. The constellation fades out, the canvas fades up and the rail slides in. |
| `setBoot(message)` | One line naming the real work being waited on ("Compiling shaders"). Shown with the loader only if boot takes longer than 300 ms. Pass `null` to clear. |
| `chromeHidden` | True after `H`. Anything with class `demo-chrome` hides with it. |
| `reducedMotion` | `prefers-reduced-motion: reduce` |

`useShortcut(key, label, run)` registers a demo-specific key. It is listed under
`?` and never fires while focus is in a text field. `H`, `Space`, `[`, `]` and
`?` are taken.

`<Poster>` is the last resort where nothing can run: one sentence saying what is
missing, over the constellation. Rendering it tells the shell the demo is
unavailable; do not call `setReady()` as well.

## `useStage(options)`

One hook for sizing, pixel ratio, the frame loop, pause rules and pointer input.

- **`ref`**: attach to the stage element. If it is a canvas, its backing store is
  kept at CSS size times the effective ratio. For anything else, size your own
  canvases in `onResize`.
- **Pixel ratio**: `min(devicePixelRatio, ratioCap = 2)` times a scale of 1, 0.75
  or 0.5. The scale steps down when the median frame time over 60 frames exceeds
  22 ms and never steps back up. `setScale(1 | 0.75 | 0.5 | null)` is the manual
  override; `null` returns to automatic.
- **`onFrame({ time, dt, frame, width, height, cssWidth, cssHeight, ratio })`**:
  `time` is accumulated running time in seconds and freezes while paused; `dt`
  is clamped to 1/30 s. `onFrame` can be called before your own setup has run
  (and with `dt` 0 for a repaint), so return early if your resources are not
  there yet. Call `stage.redraw()` after async setup or after a control changes
  while paused.
- **Pause rules**: nothing runs while the shell is paused, the tab is hidden,
  under 10% of the stage is on screen, or the GL context is lost. A stage that
  starts paused still gets one first frame. Set `stage.clock.current.time`
  before it if the representative frame is not t = 0.
- **`onInput`**: pointer events with capture, for mouse, touch and pen.
  `down`, `move` and `up` carry the `pointer` and the list of up to five
  `pointers`, in stage CSS pixels (multiply by `ratio` for backing pixels).
  A hovering mouse reports `move` with `pointer.down === false`. `wheel` is a
  non-passive listener, so `input.event.preventDefault()` works. `pinch` reports
  the change in distance between two fingers.
- **`pointers`**, **`sizeRef`**, **`clock`**: refs for reading live values inside
  callbacks without re-rendering. Never put per-frame values in React state.
- **`frameMs`**, **`fps`**: the median interval between frames, refreshed once a
  second, for the ledger.
- **`contextLost`**, `onContextLost`, `onContextRestored`: WebGL context loss.
- `touchAction`: `'none'` for a full stage (default), `'pan-y'` for a visual
  inside a scrolling page. `loop: false` for a stage that only redraws on demand.

## Parts

| Part | Notes |
| --- | --- |
| `<Stage>` | Full-bleed `100dvh`. Give the canvas `className="demo-canvas"`. `pausable={false}` if there is nothing to pause. |
| `<ScrollLayout visual>` | Pinned visual and a scrolling column. `pausable` defaults to false. |
| `<Rail label tabs?>` | The floating control panel. Collapses to a tab on desktop; a bottom sheet under 768 px (rest 96 px, half, full). `tabs` puts several panels in one rail. `useIsPhone()` reports the breakpoint. |
| `<Ledger rows placement?>` | Up to four `{ key, value, signal? }` rows. `placement="inline"` for use outside a stage. Announces to assistive technology at most once a second. |
| `<Notes slug>`, `<NotesSection title>`, `<NotesSource files>` | The notes below the stage: what you are looking at, how it works, the source. One 68-character column. |
| `Slider`, `Toggle`, `Segmented`, `Select`, `Button`, `Actions` | `controls.tsx`. Every control has a label, a focus ring and a 44 px target. `Segmented` takes up to five options; above that use `Select`. One `variant="primary"` button per demo at most; the rest are underlined text. |

Float your own chrome over a stage with `className="demo-chrome"` so it rests
dim, comes up on hover or focus, and hides with `H`. Back it with `--demo-veil`.

## Copy

Sentence case. No exclamation marks, no emoji. A control is named for what it
changes on screen. An error says what happened and what to do next, beside the
action that caused it, and never replaces the page. A number is shown only if it
was measured on this visitor's machine.
