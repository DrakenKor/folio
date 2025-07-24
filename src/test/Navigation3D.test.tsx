import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Navigation3D } from '@/components/Navigation3D'
import { useAppStore } from '@/stores/app-store'
import { SectionType } from '@/types'

// Mock Three.js and React Three Fiber
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({
    camera: {
      position: { set: jest.fn() },
      lookAt: jest.fn()
    }
  })
}))

jest.mock('@react-three/drei', () => ({
  Text: ({ children }: { children: React.ReactNode }) => <div data-testid="text">{children}</div>,
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>
}))

jest.mock('three', () => ({
  Vector3: class {
    constructor(public x = 0, public y = 0, public z = 0) {}
    set(x: number, y: number, z: number) {
      this.x = x
      this.y = y
      this.z = z
    }
    setScalar(s: number) {
      this.x = this.y = this.z = s
    }
  },
  MathUtils: {
    lerp: (a: number, b: number, t: number) => a + (b - a) * t
  },
  DoubleSide: 2
}))

// Mock the navigation hook
jest.mock('@/hooks/useNavigation3D', () => ({
  useNavigation3D: () => ({
    isVisible: true,
    isCompact: false,
    isMobile: false,
    currentSection: SectionType.HOME,
    isTransitioning: false,
    navigateToSection: jest.fn(),
    toggleVisibility: jest.fn()
  })
}))

describe('Navigation3D', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppStore.setState({
      navigation: {
        currentSection: SectionType.HOME,
        previousSection: null,
        isTransitioning: false,
        transitionProgress: 0
      }
    })
  })

  it('renders the 3D navigation canvas', () => {
    render(<Navigation3D />)

    expect(screen.getByTestId('canvas')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('provides proper accessibility attributes', () => {
    render(<Navigation3D />)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', '3D Portfolio Navigation')

    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('aria-hidden', 'false')
  })

  it('handles keyboard navigation', () => {
    render(<Navigation3D />)

    const nav = screen.getByRole('navigation')

    // Test arrow key navigation
    fireEvent.keyDown(nav, { key: 'ArrowRight' })
    fireEvent.keyDown(nav, { key: 'ArrowLeft' })
    fireEvent.keyDown(nav, { key: 'Enter' })
    fireEvent.keyDown(nav, { key: 'Escape' })

    // Should not throw any errors
    expect(nav).toBeInTheDocument()
  })

  it('shows mobile toggle button on mobile devices', () => {
    // Mock mobile device
    jest.doMock('@/hooks/useNavigation3D', () => ({
      useNavigation3D: () => ({
        isVisible: true,
        isCompact: false,
        isMobile: true,
        currentSection: SectionType.HOME,
        isTransitioning: false,
        navigateToSection: jest.fn(),
        toggleVisibility: jest.fn()
      })
    }))

    render(<Navigation3D />)

    const toggleButton = screen.getByLabelText(/navigation menu/i)
    expect(toggleButton).toBeInTheDocument()
  })

  it('applies responsive classes correctly', () => {
    render(<Navigation3D />)

    // Check that responsive classes are applied
    const menuContainer = screen.getByRole('menu')
    expect(menuContainer.className).toContain('w-96')
    expect(menuContainer.className).toContain('h-96')
  })
})
