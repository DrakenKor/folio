'use client'

import { ButtonHTMLAttributes, CSSProperties, KeyboardEvent, ReactNode, useId } from 'react'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const decimals = (step: number) => {
  const text = String(step)
  return text.includes('.') ? text.split('.')[1].length : 0
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  // Double-click returns here
  defaultValue?: number
  onChange: (value: number) => void
  // Fires when a drag or key press ends, for work too heavy to run per tick
  onCommit?: (value: number) => void
  format?: (value: number) => string
  disabled?: boolean
}

/**
 * A real range input. Arrow keys step, Shift steps by ten, double-click
 * resets to the default.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
  onCommit,
  format,
  disabled
}: SliderProps) {
  const id = useId()
  const places = decimals(step)
  const text = format ? format(value) : value.toFixed(places)
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.shiftKey) return
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    onChange(Number(clamp(value + direction * step * 10, min, max).toFixed(places)))
  }

  return (
    <div className="demo-field demo-slider" data-disabled={disabled ? 'true' : undefined}>
      <div className="demo-field-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{text}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={event => onChange(Number(event.target.value))}
        onKeyDown={onKeyDown}
        onPointerUp={() => onCommit?.(value)}
        onKeyUp={() => onCommit?.(value)}
        onDoubleClick={() => {
          if (defaultValue === undefined) return
          onChange(defaultValue)
          onCommit?.(defaultValue)
        }}
      />
    </div>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

// A real checkbox drawn as a diamond outline that fills when on
export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="demo-toggle" data-disabled={disabled ? 'true' : undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <span className="demo-toggle-mark" aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

export interface Option<T extends string | number> {
  value: T
  label: string
  disabled?: boolean
}

interface ChoiceProps<T extends string | number> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}

// Up to five options. Above that, use <Select>.
export function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: ChoiceProps<T>) {
  const name = useId()
  return (
    <fieldset className="demo-field demo-segmented" disabled={disabled}>
      <legend>{label}</legend>
      <div className="demo-segmented-options">
        {options.map(option => (
          <label key={option.value} data-checked={option.value === value ? 'true' : 'false'}>
            <input
              type="radio"
              name={name}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Select<T extends string | number>({ label, value, options, onChange, disabled }: ChoiceProps<T>) {
  const id = useId()
  return (
    <div className="demo-field demo-select">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={String(value)}
        disabled={disabled}
        onChange={event => {
          const match = options.find(option => String(option.value) === event.target.value)
          if (match) onChange(match.value)
        }}>
        {options.map(option => (
          <option key={option.value} value={String(option.value)} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // At most one primary per demo: a hairline pill that inverts on hover.
  // Everything else is underlined text, the home page's link idiom.
  variant?: 'primary' | 'text'
  children: ReactNode
}

export function Button({ variant = 'text', className, type = 'button', children, ...rest }: ButtonProps) {
  const base = variant === 'primary' ? 'demo-button' : 'demo-text-button'
  return (
    <button type={type} className={className ? `${base} ${className}` : base} {...rest}>
      {children}
    </button>
  )
}

// A row of text buttons, wrapped
export function Actions({ children }: { children: ReactNode }) {
  return <div className="demo-actions">{children}</div>
}
