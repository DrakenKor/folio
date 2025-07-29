import React from 'react'

interface IconProps {
  className?: string
  size?: number
}

export const FourierIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <path
      d="M2 12C2 12 4 8 6 12C8 16 10 8 12 12C14 16 16 8 18 12C20 16 22 12 22 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 16C2 16 4 14 6 16C8 18 10 14 12 16C14 18 16 14 18 16C20 18 22 16 22 16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
    <path
      d="M2 8C2 8 4 6 6 8C8 10 10 6 12 8C14 10 16 6 18 8C20 10 22 8 22 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
  </svg>
)

export const FractalIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <path
      d="M12 2L15.09 8.26L22 9L17 14.74L18.18 22L12 18.27L5.82 22L7 14.74L2 9L8.91 8.26L12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 6L13.5 9.5L17 10L14.5 12.5L15.09 16L12 14.27L8.91 16L9.5 12.5L7 10L10.5 9.5L12 6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
    <circle
      cx="12"
      cy="12"
      r="2"
      stroke="currentColor"
      strokeWidth="1"
      opacity="0.5"
    />
  </svg>
)

export const AlgorithmIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <path
      d="M13 2L3 14L12 14L11 22L21 10L12 10L13 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 6L6 8L8 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
    <path
      d="M16 14L18 16L16 18"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
  </svg>
)

export const NeuralIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    {/* Input layer */}
    <circle cx="4" cy="6" r="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="4" cy="18" r="2" stroke="currentColor" strokeWidth="2" />

    {/* Hidden layer */}
    <circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
    <circle cx="12" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
    <circle cx="12" cy="15" r="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
    <circle cx="12" cy="20" r="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />

    {/* Output layer */}
    <circle cx="20" cy="9" r="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="20" cy="15" r="2" stroke="currentColor" strokeWidth="2" />

    {/* Connections */}
    <path d="M6 6L10.5 4" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M6 6L10.5 9" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M6 12L10.5 9" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M6 12L10.5 15" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M6 18L10.5 15" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M6 18L10.5 20" stroke="currentColor" strokeWidth="1" opacity="0.4" />

    <path d="M13.5 4L18 9" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M13.5 9L18 9" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M13.5 15L18 15" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <path d="M13.5 20L18 15" stroke="currentColor" strokeWidth="1" opacity="0.4" />
  </svg>
)

// Icon mapping for easy access
export const mathGalleryIcons = {
  fourier: FourierIcon,
  fractal: FractalIcon,
  algorithm: AlgorithmIcon,
  neural: NeuralIcon
} as const

export type MathGalleryIconType = keyof typeof mathGalleryIcons
