// A plain-DOM debug panel of sliders. Hidden unless `?panel=1`; the backquote
// key toggles it.

export interface Slider {
  label: string
  min: number
  max: number
  step: number
  get(): number
  set(value: number): void
}

export interface SliderGroup {
  title: string
  sliders: Slider[]
}

export function createPanel(groups: SliderGroup[], visible: boolean): HTMLElement {
  const panel = document.createElement('div')
  panel.id = 'look-panel'
  Object.assign(panel.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    width: '250px',
    maxHeight: 'calc(100% - 24px)',
    overflowY: 'auto',
    padding: '10px 12px',
    background: 'rgba(20, 26, 38, 0.82)',
    color: '#e8edf5',
    borderRadius: '8px',
    display: visible ? 'block' : 'none',
    zIndex: '10'
  } satisfies Partial<CSSStyleDeclaration>)

  for (const group of groups) {
    const heading = document.createElement('div')
    heading.textContent = group.title
    Object.assign(heading.style, { fontWeight: '600', margin: '6px 0 4px', letterSpacing: '0.04em' })
    panel.append(heading)
    for (const slider of group.sliders) {
      const row = document.createElement('label')
      Object.assign(row.style, { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 8px', margin: '2px 0 6px' })
      const name = document.createElement('span')
      name.textContent = slider.label
      const value = document.createElement('span')
      value.style.fontVariantNumeric = 'tabular-nums'
      const input = document.createElement('input')
      input.type = 'range'
      input.min = String(slider.min)
      input.max = String(slider.max)
      input.step = String(slider.step)
      input.value = String(slider.get())
      input.style.gridColumn = '1 / span 2'
      const show = () => {
        value.textContent = Number(input.value).toFixed(slider.step < 0.01 ? 4 : slider.step < 1 ? 2 : 0)
      }
      input.addEventListener('input', () => {
        slider.set(Number(input.value))
        show()
      })
      show()
      row.append(name, value, input)
      panel.append(row)
    }
  }

  window.addEventListener('keydown', event => {
    if (event.key === '`') panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
  })
  document.body.append(panel)
  return panel
}
