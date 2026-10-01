'use client'

import { ReactNode } from 'react'
import { Actions, Button, Segmented, Select, Slider, Toggle } from '@/components/demo/controls'
import { MathVisualization, VisualizationControl } from '@/types/math-visualization'

function Field({ control }: { control: VisualizationControl }) {
  const { label, value, disabled, onChange } = control
  if (control.type === 'slider') {
    return (
      <Slider
        label={label}
        value={value as number}
        min={control.min ?? 0}
        max={control.max ?? 1}
        step={control.step}
        defaultValue={control.defaultValue}
        format={control.format}
        disabled={disabled}
        onChange={onChange}
      />
    )
  }
  if (control.type === 'toggle') return <Toggle label={label} checked={value === true} disabled={disabled} onChange={onChange} />
  const choice = { label, value: String(value), options: control.options ?? [], disabled, onChange }
  return control.type === 'segmented' ? <Segmented {...choice} /> : <Select {...choice} />
}

/**
 * An exhibit's controls, drawn from its own description of them. Keys are the
 * control ids, so a slider keeps its drag while its value changes.
 */
export function ControlPanel({ exhibit }: { exhibit: MathVisualization }) {
  const controls = exhibit.getControls()
  const nodes: ReactNode[] = []
  for (let i = 0; i < controls.length; i++) {
    const control = controls[i]
    // Neighbours of the same kind are set together: buttons in a row,
    // grouped toggles side by side under the group's name
    const run = [control]
    const together = (next?: VisualizationControl) =>
      !!next && (control.type === 'button' ? next.type === 'button' : !!control.group && next.group === control.group)
    while (together(controls[i + 1])) run.push(controls[++i])

    if (control.type === 'button') {
      nodes.push(
        <Actions key={control.id}>
          {run.map(button => (
            <Button
              key={button.id}
              variant={button.primary ? 'primary' : 'text'}
              disabled={button.disabled}
              onClick={() => button.onChange(true)}>
              {button.label}
            </Button>
          ))}
        </Actions>
      )
    } else if (control.group) {
      nodes.push(
        <fieldset key={control.group} className="demo-field math-group">
          <legend>{control.group}</legend>
          <div>
            {run.map(entry => (
              <Field key={entry.id} control={entry} />
            ))}
          </div>
        </fieldset>
      )
    } else {
      nodes.push(<Field key={control.id} control={control} />)
    }
  }
  return <>{nodes}</>
}
