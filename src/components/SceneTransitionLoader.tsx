'use client'

import React from 'react'
import { LoadingStage } from '@/lib/scene-management/SceneTransitionManager'
import { useSceneLoadingState } from '@/hooks/useSceneTransition'

interface SceneTransitionLoaderProps {
  className?: string
  showMessage?: boolean
  showProgress?: boolean
  variant?: 'minimal' | 'detailed' | 'fullscreen'
}

/**
 * Loading indicator component for scene transitions
 */
export function SceneTransitionLoader({
  className = '',
  showMessage = true,
  showProgress = true,
  variant = 'detailed'
}: SceneTransitionLoaderProps) {
  const { isLoading, progress, currentStage, loadingMessage } = useSceneLoadingState()

  if (!isLoading) return null

  const getStageIcon = (stage: LoadingStage) => {
    switch (stage) {
      case LoadingStage.PREPARING:
        return '⚙️'
      case LoadingStage.LOADING_ASSETS:
        return '📦'
      case LoadingStage.INITIALIZING:
        return '🚀'
      case LoadingStage.TRANSITIONING:
        return '✨'
      case LoadingStage.COMPLETE:
        return '✅'
      default:
        return '⏳'
    }
  }

  const getStageColor = (stage: LoadingStage) => {
    switch (stage) {
      case LoadingStage.PREPARING:
        return 'text-yellow-400'
      case LoadingStage.LOADING_ASSETS:
        return 'text-blue-400'
      case LoadingStage.INITIALIZING:
        return 'text-purple-400'
      case LoadingStage.TRANSITIONING:
        return 'text-green-400'
      case LoadingStage.COMPLETE:
        return 'text-emerald-400'
      default:
        return 'text-gray-400'
    }
  }

  if (variant === 'minimal') {
    return (
      <div className={`fixed top-4 right-4 z-50 ${className}`}>
        <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 flex items-center space-x-2">
          <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
          {showProgress && (
            <span className="text-white text-sm font-mono">
              {Math.round(progress * 100)}%
            </span>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'fullscreen') {
    return (
      <div className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center ${className}`}>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">
              {getStageIcon(currentStage)}
            </div>

            {showMessage && (
              <h3 className="text-white text-lg font-semibold mb-2">
                {loadingMessage}
              </h3>
            )}

            {showProgress && (
              <>
                <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>

                <div className="flex justify-between text-white/70 text-sm">
                  <span className={getStageColor(currentStage)}>
                    {currentStage.replace('-', ' ').toUpperCase()}
                  </span>
                  <span className="font-mono">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Default detailed variant
  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 min-w-[280px]">
        <div className="flex items-center space-x-3 mb-3">
          <div className="text-2xl animate-pulse">
            {getStageIcon(currentStage)}
          </div>
          <div className="flex-1">
            {showMessage && (
              <div className="text-white text-sm font-medium mb-1">
                {loadingMessage}
              </div>
            )}
            <div className={`text-xs ${getStageColor(currentStage)}`}>
              {currentStage.replace('-', ' ').toUpperCase()}
            </div>
          </div>
        </div>

        {showProgress && (
          <>
            <div className="w-full bg-white/20 rounded-full h-1.5 mb-2">
              <div
                className="bg-gradient-to-r from-blue-400 to-purple-400 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-white/70 text-xs">
              <span>Loading...</span>
              <span className="font-mono">
                {Math.round(progress * 100)}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Simple progress bar component for scene transitions
 */
export function SceneTransitionProgressBar({ className = '' }: { className?: string }) {
  const { isLoading, progress } = useSceneLoadingState()

  if (!isLoading) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
      <div className="w-full bg-black/20 h-1">
        <div
          className="bg-gradient-to-r from-blue-400 to-purple-400 h-1 transition-all duration-300 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Floating loading indicator for scene transitions
 */
export function SceneTransitionFloatingLoader({ className = '' }: { className?: string }) {
  const { isLoading, currentStage } = useSceneLoadingState()

  if (!isLoading) return null

  return (
    <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 ${className}`}>
      <div className="bg-white/10 backdrop-blur-md rounded-full p-6 animate-pulse">
        <div className="text-4xl">
          {currentStage === LoadingStage.PREPARING && '⚙️'}
          {currentStage === LoadingStage.LOADING_ASSETS && '📦'}
          {currentStage === LoadingStage.INITIALIZING && '🚀'}
          {currentStage === LoadingStage.TRANSITIONING && '✨'}
          {currentStage === LoadingStage.COMPLETE && '✅'}
        </div>
      </div>
    </div>
  )
}
