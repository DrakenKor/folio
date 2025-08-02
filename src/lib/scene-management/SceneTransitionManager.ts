import * as THREE from 'three'
import { SceneManager } from './SceneManager'
import { CameraController, EasingFunction, SceneType } from './types'
import { TransitionOptions } from '@/types'

export interface TransitionState {
  isTransitioning: boolean
  progress: number
  fromScene: SceneType | null
  toScene: SceneType | null
  startTime: number
  duration: number
  easing: EasingFunction
}

export interface LoadingState {
  isLoading: boolean
  progress: number
  stage: LoadingStage
  message: string
}

export enum LoadingStage {
  PREPARING = 'preparing',
  LOADING_ASSETS = 'loading-assets',
  INITIALIZING = 'initializing',
  TRANSITIONING = 'transitioning',
  COMPLETE = 'complete'
}

export interface TransitionCallbacks {
  onStart?: (fromScene: SceneType | null, toScene: SceneType) => void
  onProgress?: (progress: number, stage: LoadingStage) => void
  onLoadingStart?: (stage: LoadingStage, message: string) => void
  onLoadingProgress?: (progress: number, stage: LoadingStage) => void
  onLoadingComplete?: (stage: LoadingStage) => void
  onComplete?: (toScene: SceneType) => void
  onError?: (error: Error) => void
}

/**
 * SceneTransitionManager handles smooth transitions between 3D scenes
 * with loading states, progress indicators, and advanced easing functions
 */
export class SceneTransitionManager {
  private static instance: SceneTransitionManager
  private sceneManager: SceneManager
  private transitionState: TransitionState
  private loadingState: LoadingState
  private callbacks: TransitionCallbacks = {}
  private animationFrameId: number | null = null

  public static getInstance(): SceneTransitionManager {
    if (!SceneTransitionManager.instance) {
      SceneTransitionManager.instance = new SceneTransitionManager()
    }
    return SceneTransitionManager.instance
  }

  private constructor() {
    this.sceneManager = SceneManager.getInstance()
    this.transitionState = {
      isTransitioning: false,
      progress: 0,
      fromScene: null,
      toScene: null,
      startTime: 0,
      duration: 1000,
      easing: this.getEasingFunction('easeInOutCubic')
    }
    this.loadingState = {
      isLoading: false,
      progress: 0,
      stage: LoadingStage.COMPLETE,
      message: ''
    }
  }

  /**
   * Set transition callbacks
   */
  public setCallbacks(callbacks: TransitionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * Get current transition state
   */
  public getTransitionState(): TransitionState {
    return { ...this.transitionState }
  }

  /**
   * Get current loading state
   */
  public getLoadingState(): LoadingState {
    return { ...this.loadingState }
  }

  /**
   * Transition to a new scene with enhanced loading and progress tracking
   */
  public async transitionTo(
    sceneType: SceneType,
    options: TransitionOptions = { duration: 1000, easing: 'easeInOutCubic' }
  ): Promise<void> {
    if (this.transitionState.isTransitioning) {
      console.warn('Transition already in progress')
      return
    }

    const fromScene = this.sceneManager.currentScene

    // Initialize transition state
    this.transitionState = {
      isTransitioning: true,
      progress: 0,
      fromScene,
      toScene: sceneType,
      startTime: performance.now(),
      duration: options.duration,
      easing: this.getEasingFunction(options.easing)
    }

    try {
      // Notify transition start
      if (this.callbacks.onStart) {
        this.callbacks.onStart(fromScene, sceneType)
      }

      // Start loading sequence
      await this.executeLoadingSequence(sceneType)

      // Perform the actual scene transition
      await this.performSceneTransition(sceneType, options)

      // Complete transition
      this.completeTransition(sceneType)

    } catch (error) {
      this.handleTransitionError(error as Error)
    }
  }

  /**
   * Execute the loading sequence with progress tracking
   */
  private async executeLoadingSequence(sceneType: SceneType): Promise<void> {
    // Stage 1: Preparing
    await this.setLoadingStage(LoadingStage.PREPARING, 'Preparing scene transition...', 0)
    await this.delay(100) // Small delay for visual feedback

    // Stage 2: Loading Assets
    await this.setLoadingStage(LoadingStage.LOADING_ASSETS, 'Loading scene assets...', 0)
    await this.loadSceneAssets(sceneType)

    // Stage 3: Initializing
    await this.setLoadingStage(LoadingStage.INITIALIZING, 'Initializing scene...', 0)
    await this.initializeScene(sceneType)

    // Stage 4: Transitioning
    await this.setLoadingStage(LoadingStage.TRANSITIONING, 'Transitioning camera...', 0)
  }

  /**
   * Load assets for the target scene
   */
  private async loadSceneAssets(sceneType: SceneType): Promise<void> {
    const scene = this.sceneManager.getScene(sceneType)
    if (!scene) {
      throw new Error(`Scene ${sceneType} not found`)
    }

    // Simulate asset loading with progress updates
    const steps = 10
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps
      this.updateLoadingProgress(progress, LoadingStage.LOADING_ASSETS)

      // Simulate loading time
      await this.delay(50)
    }
  }

  /**
   * Initialize the target scene
   */
  private async initializeScene(sceneType: SceneType): Promise<void> {
    const scene = this.sceneManager.getScene(sceneType)
    if (!scene) {
      throw new Error(`Scene ${sceneType} not found`)
    }

    // Initialize scene if not already initialized
    if (!scene.isInitialized) {
      const steps = 5
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps
        this.updateLoadingProgress(progress, LoadingStage.INITIALIZING)
        await this.delay(100)
      }
    } else {
      this.updateLoadingProgress(1, LoadingStage.INITIALIZING)
    }
  }

  /**
   * Perform the actual scene transition
   */
  private async performSceneTransition(
    sceneType: SceneType,
    options: TransitionOptions
  ): Promise<void> {
    // Start transition animation
    this.startTransitionAnimation()

    // Use SceneManager's transition method
    await this.sceneManager.transitionTo(sceneType, options)
  }

  /**
   * Start the transition animation loop
   */
  private startTransitionAnimation(): void {
    if (this.animationFrameId !== null) return

    const animate = () => {
      if (!this.transitionState.isTransitioning) {
        this.animationFrameId = null
        return
      }

      const currentTime = performance.now()
      const elapsed = currentTime - this.transitionState.startTime
      let progress = Math.min(elapsed / this.transitionState.duration, 1)

      // Apply easing
      progress = this.transitionState.easing(progress)

      // Update transition progress
      this.transitionState.progress = progress
      this.updateLoadingProgress(progress, LoadingStage.TRANSITIONING)

      // Continue animation if not complete
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate)
      } else {
        this.animationFrameId = null
      }
    }

    this.animationFrameId = requestAnimationFrame(animate)
  }

  /**
   * Complete the transition
   */
  private completeTransition(sceneType: SceneType): void {
    // Set final loading stage
    this.setLoadingStage(LoadingStage.COMPLETE, 'Transition complete', 1)

    // Reset states
    this.transitionState.isTransitioning = false
    this.transitionState.progress = 1
    this.loadingState.isLoading = false

    // Notify completion
    if (this.callbacks.onComplete) {
      this.callbacks.onComplete(sceneType)
    }

    // Clean up animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Handle transition errors
   */
  private handleTransitionError(error: Error): void {
    console.error('Scene transition failed:', error)

    // Reset states
    this.transitionState.isTransitioning = false
    this.loadingState.isLoading = false

    // Clean up animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Notify error
    if (this.callbacks.onError) {
      this.callbacks.onError(error)
    }
  }

  /**
   * Set loading stage with progress tracking
   */
  private async setLoadingStage(
    stage: LoadingStage,
    message: string,
    progress: number
  ): Promise<void> {
    this.loadingState = {
      isLoading: stage !== LoadingStage.COMPLETE,
      progress,
      stage,
      message
    }

    // Notify loading start
    if (this.callbacks.onLoadingStart) {
      this.callbacks.onLoadingStart(stage, message)
    }

    // Notify progress
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(progress, stage)
    }
  }

  /**
   * Update loading progress for current stage
   */
  private updateLoadingProgress(progress: number, stage: LoadingStage): void {
    this.loadingState.progress = progress

    // Notify loading progress
    if (this.callbacks.onLoadingProgress) {
      this.callbacks.onLoadingProgress(progress, stage)
    }

    // Notify general progress
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(progress, stage)
    }

    // Notify loading complete if progress is 1
    if (progress >= 1 && this.callbacks.onLoadingComplete) {
      this.callbacks.onLoadingComplete(stage)
    }
  }

  /**
   * Get easing function by name
   */
  private getEasingFunction(name: string): EasingFunction {
    const easingFunctions = {
      linear: (t: number) => t,
      easeInQuad: (t: number) => t * t,
      easeOutQuad: (t: number) => t * (2 - t),
      easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      easeInCubic: (t: number) => t * t * t,
      easeOutCubic: (t: number) => (--t) * t * t + 1,
      easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
      easeInQuart: (t: number) => t * t * t * t,
      easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
      easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
      easeInQuint: (t: number) => t * t * t * t * t,
      easeOutQuint: (t: number) => 1 + (--t) * t * t * t * t,
      easeInOutQuint: (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
      easeInSine: (t: number) => 1 - Math.cos(t * Math.PI / 2),
      easeOutSine: (t: number) => Math.sin(t * Math.PI / 2),
      easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
      easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
      easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
      easeInOutExpo: (t: number) => {
        if (t === 0) return 0
        if (t === 1) return 1
        if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2
        return (2 - Math.pow(2, -20 * t + 10)) / 2
      },
      easeInCirc: (t: number) => 1 - Math.sqrt(1 - t * t),
      easeOutCirc: (t: number) => Math.sqrt(1 - (--t) * t),
      easeInOutCirc: (t: number) => {
        if (t < 0.5) return (1 - Math.sqrt(1 - 4 * t * t)) / 2
        return (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2
      },
      easeInBack: (t: number) => {
        const c1 = 1.70158
        const c3 = c1 + 1
        return c3 * t * t * t - c1 * t * t
      },
      easeOutBack: (t: number) => {
        const c1 = 1.70158
        const c3 = c1 + 1
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
      },
      easeInOutBack: (t: number) => {
        const c1 = 1.70158
        const c2 = c1 * 1.525
        return t < 0.5
          ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
          : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
      },
      easeInElastic: (t: number) => {
        const c4 = (2 * Math.PI) / 3
        return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4)
      },
      easeOutElastic: (t: number) => {
        const c4 = (2 * Math.PI) / 3
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
      },
      easeInOutElastic: (t: number) => {
        const c5 = (2 * Math.PI) / 4.5
        return t === 0 ? 0 : t === 1 ? 1 : t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1
      },
      easeInBounce: (t: number) => 1 - this.getEasingFunction('easeOutBounce')(1 - t),
      easeOutBounce: (t: number) => {
        const n1 = 7.5625
        const d1 = 2.75
        if (t < 1 / d1) {
          return n1 * t * t
        } else if (t < 2 / d1) {
          return n1 * (t -= 1.5 / d1) * t + 0.75
        } else if (t < 2.5 / d1) {
          return n1 * (t -= 2.25 / d1) * t + 0.9375
        } else {
          return n1 * (t -= 2.625 / d1) * t + 0.984375
        }
      },
      easeInOutBounce: (t: number) => {
        return t < 0.5
          ? (1 - this.getEasingFunction('easeOutBounce')(1 - 2 * t)) / 2
          : (1 + this.getEasingFunction('easeOutBounce')(2 * t - 1)) / 2
      }
    }

    return easingFunctions[name as keyof typeof easingFunctions] || easingFunctions.linear
  }

  /**
   * Utility function to create delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Dispose of the transition manager
   */
  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.transitionState.isTransitioning = false
    this.loadingState.isLoading = false
    this.callbacks = {}
  }
}
