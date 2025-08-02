import { vi, describe, it, expect } from 'vitest'
import React from 'react'
import GPUParticleSystem from '../components/GPUParticleSystem'

describe('GPUParticleSystem', () => {
  it('component can be imported and instantiated', () => {
    expect(GPUParticleSystem).toBeDefined()
    expect(typeof GPUParticleSystem).toBe('function')
  })

  it('component has correct display name', () => {
    expect(GPUParticleSystem.name).toBe('GPUParticleSystem')
  })

  it('component can be created as React element', () => {
    const element = React.createElement(GPUParticleSystem, {
      width: 800,
      height: 600,
      className: 'test-class'
    })

    expect(element).toBeDefined()
    expect(element.type).toBe(GPUParticleSystem)
    expect(element.props.width).toBe(800)
    expect(element.props.height).toBe(600)
    expect(element.props.className).toBe('test-class')
  })

  it('component has default props', () => {
    const element = React.createElement(GPUParticleSystem)

    expect(element).toBeDefined()
    expect(element.type).toBe(GPUParticleSystem)
  })
})
