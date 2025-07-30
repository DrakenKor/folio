/**
 * TypeScript interfaces for WASM modules
 */

export interface WASMCoreModule {
  // Core module management
  WASMModule: new () => WASMModuleInstance
  ImageProcessor: new (width: number, height: number) => ImageProcessorInstance
  greet(name: string): string
  performance_test(iterations: number): number

  // Mathematical operations
  fibonacci(n: number): bigint
  prime_sieve(limit: number): Uint32Array
  matrix_multiply(
    a: Float64Array,
    b: Float64Array,
    rows_a: number,
    cols_a: number,
    cols_b: number
  ): Float64Array

  // Array operations
  sum_array(arr: Float64Array): number
  sort_array(arr: Float64Array): void
  find_max(arr: Float64Array): number
  find_min(arr: Float64Array): number

  // String operations
  reverse_string(s: string): string
  count_words(s: string): number

  // Image processing functions
  apply_blur(data: Uint8ClampedArray, width: number, height: number, radius: number): void
  apply_edge_detection(data: Uint8ClampedArray, width: number, height: number): void
  apply_color_filter(data: Uint8ClampedArray, width: number, height: number, filter: string): void
  adjust_brightness(data: Uint8ClampedArray, width: number, height: number, factor: number): void
  adjust_contrast(data: Uint8ClampedArray, width: number, height: number, factor: number): void
  apply_sharpen(data: Uint8ClampedArray, width: number, height: number, strength: number): void

  // Utility functions
  get_memory_usage(): number
  force_gc(): void
  safe_divide(a: number, b: number): number
}

export interface WASMModuleInstance {
  name: string
  module: any
  initialized: boolean
  memoryUsage: number
  dispose(): void
  get_version?(): string
  get_uptime?(): number
  is_initialized?(): boolean
}

export interface ImageProcessorInstance {
  get_width(): number
  get_height(): number
  set_dimensions(width: number, height: number): void
}

export interface WASMImageProcessingModule {
  // Image processing functions (to be implemented in subtask 7.2)
  apply_blur(imageData: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray
  apply_edge_detection(imageData: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray
  apply_color_filter(imageData: Uint8ClampedArray, width: number, height: number, filter: string): Uint8ClampedArray
  adjust_brightness(imageData: Uint8ClampedArray, width: number, height: number, factor: number): Uint8ClampedArray
  adjust_contrast(imageData: Uint8ClampedArray, width: number, height: number, factor: number): Uint8ClampedArray
}

export interface WASMPhysicsModule {
  // Physics simulation functions (to be implemented in subtask 7.3)
  ParticleSystem: new (particle_count: number) => ParticleSystemInstance
  simulate_step(dt: number): void
  get_particle_positions(): Float32Array
  get_particle_velocities(): Float32Array
  set_gravity(x: number, y: number): void
  add_force(particle_id: number, fx: number, fy: number): void
}

export interface ParticleSystemInstance {
  update(dt: number): void
  get_positions(): Float32Array
  get_velocities(): Float32Array
  set_position(index: number, x: number, y: number): void
  set_velocity(index: number, vx: number, vy: number): void
  get_particle_count(): number
}

export interface WASMCryptoModule {
  // Cryptographic functions (to be implemented in subtask 7.4)
  sha256_hash(data: string): string
  md5_hash(data: string): string
  simple_encrypt(data: string, key: string): string
  simple_decrypt(encrypted: string, key: string): string
  generate_random_bytes(length: number): Uint8Array
  xor_cipher(data: Uint8Array, key: Uint8Array): Uint8Array
}

// Union type for all WASM modules
export type WASMModule =
  | WASMCoreModule
  | WASMImageProcessingModule
  | WASMPhysicsModule
  | WASMCryptoModule

// Configuration for WASM module loading
export interface WASMModuleConfig {
  name: string
  path: string
  fallbackAvailable: boolean
  sizeLimit?: number
  estimatedSize?: number
  compressionRatio?: number
  dependencies?: string[]
}

// Performance comparison results
export interface WASMPerformanceResult {
  wasmTime: number
  jsTime: number
  speedup: number
  memoryUsage: number
  operationsPerSecond: number
}

// Error types for WASM operations
export class WASMError extends Error {
  constructor(
    message: string,
    public readonly moduleName: string,
    public readonly operation: string
  ) {
    super(`WASM Error in ${moduleName}.${operation}: ${message}`)
    this.name = 'WASMError'
  }
}

export class WASMLoadError extends WASMError {
  constructor(moduleName: string, cause?: Error) {
    super(
      `Failed to load WASM module: ${cause?.message || 'Unknown error'}`,
      moduleName,
      'load'
    )
    this.name = 'WASMLoadError'
  }
}

export class WASMInitError extends WASMError {
  constructor(moduleName: string, cause?: Error) {
    super(
      `Failed to initialize WASM module: ${cause?.message || 'Unknown error'}`,
      moduleName,
      'initialize'
    )
    this.name = 'WASMInitError'
  }
}
