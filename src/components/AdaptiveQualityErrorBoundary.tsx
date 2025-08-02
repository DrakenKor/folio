'use client'

import React, { Component, ReactNode } from 'react'
import { QualityLevel } from '@/types'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  fallbackMode: boolean
  retryCount: number
}

export class AdaptiveQualityErrorBoundary extends Component<Props, State> {
  private maxRetries = 3
  private retryTimeout: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      fallbackMode: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Adaptive Quality System Error:', error, errorInfo)

    this.setState({
      error,
      errorInfo,
      fallbackMode: this.shouldUseFallbackMode(error)
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Attempt recovery for certain types of errors
    this.attemptRecovery(error)
  }

  private shouldUseFallbackMode(error: Error): boolean {
    const errorMessage = error.message.toLowerCase()

    // Use fallback for WebGL-related errors
    if (errorMessage.includes('webgl') ||
        errorMessage.includes('context') ||
        errorMessage.includes('shader') ||
        errorMessage.includes('texture')) {
      return true
    }

    // Use fallback for memory-related errors
    if (errorMessage.includes('memory') ||
        errorMessage.includes('allocation') ||
        errorMessage.includes('heap')) {
      return true
    }

    // Use fallback for performance-related errors
    if (errorMessage.includes('performance') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('fps')) {
      return true
    }

    return false
  }

  private attemptRecovery(error: Error) {
    if (this.state.retryCount >= this.maxRetries) {
      console.warn('Max retry attempts reached, staying in error state')
      return
    }

    // Clear any existing timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }

    // Attempt recovery after a delay
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000) // Exponential backoff

    this.retryTimeout = setTimeout(() => {
      console.log(`Attempting recovery (attempt ${this.state.retryCount + 1}/${this.maxRetries})`)

      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }))
    }, delay)
  }

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      fallbackMode: false,
      retryCount: 0
    })
  }

  private handleFallbackMode = () => {
    this.setState({
      fallbackMode: true,
      hasError: false
    })
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[200px] p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center max-w-md">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Quality System Error
            </h3>
            <p className="text-sm text-red-700 mb-4">
              {this.state.fallbackMode
                ? 'The adaptive quality system encountered an error. Using simplified rendering.'
                : 'The adaptive quality system is temporarily unavailable.'
              }
            </p>

            {this.state.error && (
              <details className="text-xs text-red-600 mb-4 text-left">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-2 justify-center">
              {!this.state.fallbackMode && (
                <button
                  onClick={this.handleFallbackMode}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                >
                  Use Safe Mode
                </button>
              )}

              <button
                onClick={this.handleManualRetry}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                disabled={this.state.retryCount >= this.maxRetries}
              >
                {this.state.retryCount >= this.maxRetries ? 'Max Retries Reached' : 'Retry'}
              </button>
            </div>

            {this.state.retryCount > 0 && (
              <p className="text-xs text-red-600 mt-2">
                Retry attempts: {this.state.retryCount}/{this.maxRetries}
              </p>
            )}
          </div>
        </div>
      )
    }

    // Render children normally if no error
    return this.props.children
  }
}

// HOC for wrapping components with adaptive quality error boundary
export function withAdaptiveQualityErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <AdaptiveQualityErrorBoundary fallback={fallback}>
      <Component {...props} />
    </AdaptiveQualityErrorBoundary>
  )

  WrappedComponent.displayName = `withAdaptiveQualityErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Safe wrapper for quality-dependent components
export const QualitySafeWrapper: React.FC<{
  children: ReactNode
  minQuality?: QualityLevel
  fallback?: ReactNode
}> = ({ children, minQuality = QualityLevel.LOW, fallback }) => {
  return (
    <AdaptiveQualityErrorBoundary
      fallback={fallback || (
        <div className="flex items-center justify-center p-4 bg-gray-100 rounded">
          <p className="text-gray-600">Quality system unavailable</p>
        </div>
      )}
    >
      {children}
    </AdaptiveQualityErrorBoundary>
  )
}
