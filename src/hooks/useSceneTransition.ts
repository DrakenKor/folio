import { useState, useEffect, useCallback } from 'react'
import { SceneTransitionManager, TransitionState, LoadingState, LoadingStage, TransitionCallbacks } from '@/lib/scene-management/SceneTransitionManager'
import { SceneType } from '@/lib/scene-management/types'
import { TransitionOptions } from '@/types'

export interface UseSceneTransitionReturn {
  transitionState: TransitionState
  loadingState: LoadingState
  transitionTo: (sceneType: SceneType, options?: TransitionOptions) => Promise<void>
  isTransitioning: boolean
  isLoading: boolean
  progress: number
  currentStage: LoadingStage
  loadingMessage: string
}

/**
 * React hook for managing scene transitions with loading states
 */
export function useSceneTransition(callbacks?: TransitionCallbacks): UseSceneTransitionReturn {
  const [transitionManager] = useState(() => SceneTransitionManager.getInstance())
  const [transitionState, setTransitionState] = useState<TransitionState>(() =>
    transitionManager.getTransitionState()
  )
  const [loadingState, setLoadingState] = useState<LoadingState>(() =>
    transitionManager.getLoadingState()
  )

  // Set up callbacks
  useEffect(() => {
    if (callbacks) {
      transitionManager.setCallbacks(callbacks)
    }
  }, [transitionManager, callbacks])

  // Update states when transition manager changes
  useEffect(() => {
    const updateStates = () => {
      setTransitionState(transitionManager.getTransitionState())
      setLoadingState(transitionManager.getLoadingState())
    }

    // Set up polling for state updates (could be optimized with events)
    const interval = setInterval(updateStates, 16) // ~60fps

    return () => {
      clearInterval(interval)
    }
  }, [transitionManager])

  const transitionTo = useCallback(
    async (sceneType: SceneType, options?: TransitionOptions) => {
      await transitionManager.transitionTo(sceneType, options)
    },
    [transitionManager]
  )

  return {
    transitionState,
    loadingState,
    transitionTo,
    isTransitioning: transitionState.isTransitioning,
    isLoading: loadingState.isLoading,
    progress: loadingState.progress,
    currentStage: loadingState.stage,
    loadingMessage: loadingState.message
  }
}

/**
 * Hook for simple scene transitions without detailed state tracking
 */
export function useSimpleSceneTransition() {
  const { transitionTo, isTransitioning } = useSceneTransition()

  return {
    transitionTo,
    isTransitioning
  }
}

/**
 * Hook specifically for loading state tracking
 */
export function useSceneLoadingState() {
  const { loadingState, isLoading, progress, currentStage, loadingMessage } = useSceneTransition()

  return {
    loadingState,
    isLoading,
    progress,
    currentStage,
    loadingMessage
  }
}
