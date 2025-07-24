import * as THREE from 'three'
import { CameraController, CameraTransitionOptions, EasingFunction } from './types'

/**
 * Implementation of the CameraController interface
 * Handles camera positioning and smooth transitions
 */
export class CameraControllerImpl implements CameraController {
  public camera: THREE.Camera
  public target: THREE.Vector3
  public isTransitioning: boolean = false

  private initialPosition: THREE.Vector3 = new THREE.Vector3()
  private initialTarget: THREE.Vector3 = new THREE.Vector3()
  private targetPosition: THREE.Vector3 = new THREE.Vector3()
  private targetLookAt: THREE.Vector3 = new THREE.Vector3()
  private transitionStartTime: number = 0
  private transitionDuration: number = 0
  private transitionEasing: EasingFunction = (t) => t
  private onTransitionUpdate: ((progress: number) => void) | null = null
  private onTransitionComplete: (() => void) | null = null

  /**
   * Create a new CameraController
   * @param camera The camera to control
   */
  constructor(camera: THREE.Camera) {
    this.camera = camera
    this.target = new THREE.Vector3(0, 0, 0)

    // Initialize camera position if not already set
    if (this.camera.position.length() === 0) {
      this.camera.position.set(0, 0, 5)
    }

    // Make camera look at target
    if (this.camera instanceof THREE.PerspectiveCamera || this.camera instanceof THREE.OrthographicCamera) {
      this.camera.lookAt(this.target)
    }
  }

  /**
   * Set the camera position and target immediately (no transition)
   */
  public setPosition(position: THREE.Vector3, target: THREE.Vector3 = this.target): void {
    this.camera.position.copy(position)
    this.target.copy(target)

    if (this.camera instanceof THREE.PerspectiveCamera || this.camera instanceof THREE.OrthographicCamera) {
      this.camera.lookAt(this.target)
    }
  }

  /**
   * Transition the camera to a new position and target
   */
  public async transitionTo(
    position: THREE.Vector3,
    target: THREE.Vector3,
    options: CameraTransitionOptions = { duration: 1000, easing: (t) => t }
  ): Promise<void> {
    if (this.isTransitioning) {
      console.warn('Camera transition already in progress')
      return
    }

    this.isTransitioning = true
    this.initialPosition.copy(this.camera.position)
    this.initialTarget.copy(this.target)
    this.targetPosition.copy(position)
    this.targetLookAt.copy(target)
    this.transitionStartTime = performance.now()
    this.transitionDuration = options.duration
    this.transitionEasing = options.easing
    this.onTransitionUpdate = options.onUpdate || null
    this.onTransitionComplete = options.onComplete || null

    return new Promise<void>((resolve) => {
      // Store the original onTransitionComplete
      const originalOnComplete = this.onTransitionComplete

      // Override onTransitionComplete to resolve the promise
      this.onTransitionComplete = () => {
        if (originalOnComplete) {
          originalOnComplete()
        }
        resolve()
      }
    })
  }

  /**
   * Update the camera transition
   */
  public update(deltaTime: number): void {
    if (!this.isTransitioning) return

    const currentTime = performance.now()
    const elapsed = currentTime - this.transitionStartTime
    let progress = Math.min(elapsed / this.transitionDuration, 1)

    // Apply easing function
    progress = this.transitionEasing(progress)

    // Update camera position
    this.camera.position.lerpVectors(this.initialPosition, this.targetPosition, progress)

    // Update target
    this.target.lerpVectors(this.initialTarget, this.targetLookAt, progress)

    // Make camera look at target
    if (this.camera instanceof THREE.PerspectiveCamera || this.camera instanceof THREE.OrthographicCamera) {
      this.camera.lookAt(this.target)
    }

    // Call update callback
    if (this.onTransitionUpdate) {
      this.onTransitionUpdate(progress)
    }

    // Check if transition is complete
    if (progress >= 1) {
      this.isTransitioning = false

      // Call complete callback
      if (this.onTransitionComplete) {
        this.onTransitionComplete()
        this.onTransitionComplete = null
      }
    }
  }

  /**
   * Resize the camera
   */
  public resize(aspect: number): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect
      this.camera.updateProjectionMatrix()
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.isTransitioning = false
    this.onTransitionUpdate = null
    this.onTransitionComplete = null
  }
}
