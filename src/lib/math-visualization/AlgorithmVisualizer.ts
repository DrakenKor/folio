import { BaseMathVisualization } from './BaseMathVisualization'
import { InteractionEvent, VisualizationControl } from '../../types/math-visualization'

interface Particle {
  value: number
  x: number
  y: number
  targetX: number
  targetY: number
  color: string
  isComparing: boolean
  isSwapping: boolean
  isActive: boolean
}

interface SortingAlgorithm {
  name: string
  id: string
  description: string
  timeComplexity: string
}

export class AlgorithmVisualizer extends BaseMathVisualization {
  private particles: Particle[] = []
  private originalValues: number[] = [] // Store original unsorted values
  private isRunning = false
  private isPaused = false
  private currentStep = 0
  private animationSpeed = 50 // ms between steps
  private lastStepTime = 0
  private sortingSteps: any[] = []
  private currentAlgorithm = 'bubble'

  private algorithms: SortingAlgorithm[] = [
    {
      name: 'Bubble Sort',
      id: 'bubble',
      description: 'Compares adjacent elements and swaps them if they are in wrong order',
      timeComplexity: 'O(n²)'
    },
    {
      name: 'Selection Sort',
      id: 'selection',
      description: 'Finds minimum element and places it at the beginning',
      timeComplexity: 'O(n²)'
    },
    {
      name: 'Insertion Sort',
      id: 'insertion',
      description: 'Builds sorted array one element at a time',
      timeComplexity: 'O(n²)'
    },
    {
      name: 'Quick Sort',
      id: 'quick',
      description: 'Divides array around pivot and recursively sorts',
      timeComplexity: 'O(n log n)'
    },
    {
      name: 'Merge Sort',
      id: 'merge',
      description: 'Divides array and merges sorted halves',
      timeComplexity: 'O(n log n)'
    }
  ]

  constructor() {
    super(
      'algorithm-visualizer',
      'Algorithm Visualization',
      'Watch sorting algorithms in action with interactive particle systems',
      'algorithm'
    )
  }

  protected setupDefaultParameters(): void {
    this.parameters = {
      algorithm: 'bubble',
      arraySize: 30,
      animationSpeed: 50,
      particleSize: 8,
      showComparisons: true,
      showSwaps: true,
      colorScheme: 'rainbow',
      isRunning: false,
      isPaused: false
    }
  }

  protected async initializeVisualization(): Promise<void> {
    this.generateRandomArray()
  }

  private generateRandomArray(): void {
    const size = this.parameters.arraySize
    const { width, height } = this.getCanvasSize()

    this.particles = []
    this.originalValues = []
    const particleWidth = Math.max(4, (width - 40) / size)

    for (let i = 0; i < size; i++) {
      const value = Math.floor(Math.random() * 200) - 100 // Values from -100 to 99
      const x = 20 + i * particleWidth + particleWidth / 2

      this.originalValues.push(value) // Store original value
      this.particles.push({
        value,
        x,
        y: 0, // Will be calculated dynamically
        targetX: x,
        targetY: 0, // Will be calculated dynamically
        color: this.getParticleColor(value, i),
        isComparing: false,
        isSwapping: false,
        isActive: false
      })
    }

    this.calculateParticlePositions()
    this.resetAnimation()
  }

  private calculateParticlePositions(): void {
    if (this.particles.length === 0) return

    const { height } = this.getCanvasSize()
    const topMargin = 100
    const bottomMargin = 60
    const availableHeight = height - topMargin - bottomMargin

    // Find min and max values for dynamic scaling
    const values = this.particles.map(p => p.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valueRange = maxValue - minValue

    // Avoid division by zero
    const safeRange = valueRange === 0 ? 1 : valueRange

    this.particles.forEach(particle => {
      // Calculate Y position based on value relative to range
      const normalizedValue = (particle.value - minValue) / safeRange
      const y = height - bottomMargin - normalizedValue * availableHeight

      particle.y = y
      particle.targetY = y
    })
  }

  private getParticleColor(value: number, index: number): string {
    switch (this.parameters.colorScheme) {
      case 'rainbow':
        const hue = ((value + 100) / 200) * 360
        return `hsl(${hue}, 70%, 60%)`
      case 'gradient':
        const intensity = Math.floor(((value + 100) / 200) * 255)
        return `rgb(${intensity}, ${100}, ${255 - intensity})`
      case 'monochrome':
        const gray = Math.floor(((value + 100) / 200) * 200) + 55
        return `rgb(${gray}, ${gray}, ${gray})`
      default:
        return '#3b82f6'
    }
  }

  private resetAnimation(): void {
    this.isRunning = false
    this.isPaused = false
    this.currentStep = 0
    this.sortingSteps = []
    this.resetParticleStates()

    // Update parameters to reflect state change
    this.parameters.isRunning = false
    this.parameters.isPaused = false
  }

  private generateSortingSteps(): void {
    const values = this.particles.map(p => p.value)
    this.sortingSteps = []

    switch (this.parameters.algorithm) {
      case 'bubble':
        this.generateBubbleSortSteps([...values]) // Create copy
        break
      case 'selection':
        this.generateSelectionSortSteps([...values]) // Create copy
        break
      case 'insertion':
        this.generateInsertionSortSteps([...values]) // Create copy
        break
      case 'quick':
        this.generateQuickSortSteps([...values], 0, values.length - 1) // Create copy
        break
      case 'merge':
        this.generateMergeSortSteps([...values]) // Create copy
        break
    }
  }

  private generateBubbleSortSteps(arr: number[]): void {
    const n = arr.length
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        this.sortingSteps.push({ type: 'compare', indices: [j, j + 1] })
        if (arr[j] > arr[j + 1]) {
          this.sortingSteps.push({ type: 'swap', indices: [j, j + 1] })
          ;[arr[j], arr[j + 1]] = [arr[j + 1], arr[j]]
        }
      }
      this.sortingSteps.push({ type: 'sorted', index: n - i - 1 })
    }
    this.sortingSteps.push({ type: 'complete' })
  }

  private generateSelectionSortSteps(arr: number[]): void {
    const n = arr.length
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i
      this.sortingSteps.push({ type: 'active', index: i })

      for (let j = i + 1; j < n; j++) {
        this.sortingSteps.push({ type: 'compare', indices: [minIdx, j] })
        if (arr[j] < arr[minIdx]) {
          minIdx = j
        }
      }

      if (minIdx !== i) {
        this.sortingSteps.push({ type: 'swap', indices: [i, minIdx] })
        ;[arr[i], arr[minIdx]] = [arr[minIdx], arr[i]]
      }
      this.sortingSteps.push({ type: 'sorted', index: i })
    }
    this.sortingSteps.push({ type: 'complete' })
  }

  private generateInsertionSortSteps(arr: number[]): void {
    for (let i = 1; i < arr.length; i++) {
      const key = arr[i]
      let j = i - 1
      this.sortingSteps.push({ type: 'active', index: i })

      while (j >= 0 && arr[j] > key) {
        this.sortingSteps.push({ type: 'compare', indices: [j, j + 1] })
        this.sortingSteps.push({ type: 'swap', indices: [j, j + 1] })
        arr[j + 1] = arr[j]
        j--
      }
      arr[j + 1] = key
    }
    this.sortingSteps.push({ type: 'complete' })
  }

  private generateQuickSortSteps(arr: number[], low: number, high: number): void {
    if (low < high) {
      const pi = this.partition(arr, low, high)
      this.generateQuickSortSteps(arr, low, pi - 1)
      this.generateQuickSortSteps(arr, pi + 1, high)
    }
  }

  private partition(arr: number[], low: number, high: number): number {
    const pivot = arr[high]
    let i = low - 1

    this.sortingSteps.push({ type: 'pivot', index: high })

    for (let j = low; j < high; j++) {
      this.sortingSteps.push({ type: 'compare', indices: [j, high] })
      if (arr[j] < pivot) {
        i++
        if (i !== j) {
          this.sortingSteps.push({ type: 'swap', indices: [i, j] })
          ;[arr[i], arr[j]] = [arr[j], arr[i]]
        }
      }
    }

    this.sortingSteps.push({ type: 'swap', indices: [i + 1, high] })
    ;[arr[i + 1], arr[high]] = [arr[high], arr[i + 1]]
    return i + 1
  }

  private generateMergeSortSteps(arr: number[]): void {
    this.mergeSortRecursive(arr, 0, arr.length - 1)
    this.sortingSteps.push({ type: 'complete' })
  }

  private mergeSortRecursive(arr: number[], left: number, right: number): void {
    if (left < right) {
      const mid = Math.floor((left + right) / 2)
      this.mergeSortRecursive(arr, left, mid)
      this.mergeSortRecursive(arr, mid + 1, right)
      this.merge(arr, left, mid, right)
    }
  }

  private merge(arr: number[], left: number, mid: number, right: number): void {
    const leftArr = arr.slice(left, mid + 1)
    const rightArr = arr.slice(mid + 1, right + 1)

    let i = 0, j = 0, k = left

    // Highlight the range being merged
    this.sortingSteps.push({ type: 'active', index: left })
    this.sortingSteps.push({ type: 'active', index: right })

    while (i < leftArr.length && j < rightArr.length) {
      // Compare elements from left and right subarrays
      this.sortingSteps.push({ type: 'compare', indices: [left + i, mid + 1 + j] })

      if (leftArr[i] <= rightArr[j]) {
        arr[k] = leftArr[i]
        this.sortingSteps.push({ type: 'place', index: k, value: leftArr[i] })
        i++
      } else {
        arr[k] = rightArr[j]
        this.sortingSteps.push({ type: 'place', index: k, value: rightArr[j] })
        j++
      }
      k++
    }

    // Copy remaining elements from left subarray
    while (i < leftArr.length) {
      arr[k] = leftArr[i]
      this.sortingSteps.push({ type: 'place', index: k, value: leftArr[i] })
      i++
      k++
    }

    // Copy remaining elements from right subarray
    while (j < rightArr.length) {
      arr[k] = rightArr[j]
      this.sortingSteps.push({ type: 'place', index: k, value: rightArr[j] })
      j++
      k++
    }
  }

  update(deltaTime: number): void {
    if (!this.ctx || !this.canvas) return

    this.clearCanvas()
    this.updateParticlePositions(deltaTime)
    this.drawParticles()
    this.drawInfo()

    // Process sorting steps
    if (this.isRunning && !this.isPaused) {
      this.lastStepTime += deltaTime
      if (this.lastStepTime >= this.parameters.animationSpeed) {
        this.processNextStep()
        this.lastStepTime = 0
      }
    }
  }

  private updateParticlePositions(deltaTime: number): void {
    this.particles.forEach(particle => {
      const speed = 0.01 * deltaTime
      particle.x += (particle.targetX - particle.x) * speed
      particle.y += (particle.targetY - particle.y) * speed
    })
  }

  private drawParticles(): void {
    if (!this.ctx) return
    const { height } = this.getCanvasSize()
    const topMargin = 100
    const bottomMargin = 60
    const availableHeight = height - topMargin - bottomMargin

    // Find min and max values for dynamic scaling
    const values = this.particles.map(p => p.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valueRange = maxValue - minValue
    const safeRange = valueRange === 0 ? 1 : valueRange

    // Calculate baseline (zero line) position
    const zeroLineY = height - bottomMargin - ((-minValue) / safeRange) * availableHeight

    // Draw zero line if we have negative values
    if (minValue < 0) {
      this.ctx.strokeStyle = '#666666'
      this.ctx.lineWidth = 1
      this.ctx.setLineDash([5, 5])
      this.ctx.beginPath()
      this.ctx.moveTo(10, zeroLineY)
      this.ctx.lineTo(this.canvas!.width - 10, zeroLineY)
      this.ctx.stroke()
      this.ctx.setLineDash([])
    }

    this.particles.forEach((particle) => {
      // Draw particle
      this.ctx!.fillStyle = particle.color

      if (particle.isComparing) {
        this.ctx!.fillStyle = '#ff6b6b'
      } else if (particle.isSwapping) {
        this.ctx!.fillStyle = '#4ecdc4'
      } else if (particle.isActive) {
        this.ctx!.fillStyle = '#45b7d1'
      }

      const size = this.parameters.particleSize

      // Calculate bar height and position based on value
      let barY, barHeight
      if (particle.value >= 0) {
        // Positive values: draw from zero line upward
        barHeight = zeroLineY - particle.y
        barY = particle.y
      } else {
        // Negative values: draw from zero line downward
        barHeight = particle.y - zeroLineY
        barY = zeroLineY
      }

      this.ctx!.fillRect(
        particle.x - size / 2,
        barY,
        size,
        barHeight
      )

      // Draw value
      this.ctx!.fillStyle = '#ffffff'
      this.ctx!.font = '10px Arial'
      this.ctx!.textAlign = 'center'

      // Position text above positive bars, below negative bars
      const textY = particle.value >= 0 ? particle.y - 5 : particle.y + 15
      this.ctx!.fillText(
        particle.value.toString(),
        particle.x,
        textY
      )
    })
  }

  private drawInfo(): void {
    if (!this.ctx) return

    const algorithm = this.algorithms.find(a => a.id === this.parameters.algorithm)
    if (!algorithm) return

    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '16px Arial'
    this.ctx.textAlign = 'left'
    this.ctx.fillText(`Algorithm: ${algorithm.name}`, 20, 30)
    this.ctx.fillText(`Time Complexity: ${algorithm.timeComplexity}`, 20, 50)
    this.ctx.fillText(`Step: ${this.currentStep}/${this.sortingSteps.length}`, 20, 70)

    if (this.isRunning) {
      this.ctx.fillText('Status: Running', 300, 30)
    } else if (this.isPaused) {
      this.ctx.fillText('Status: Paused', 300, 30)
    } else {
      this.ctx.fillText('Status: Stopped', 300, 30)
    }
  }

  private processNextStep(): void {
    if (this.currentStep >= this.sortingSteps.length) {
      this.isRunning = false
      this.parameters.isRunning = false
      this.parameters.isPaused = false
      return
    }

    const step = this.sortingSteps[this.currentStep]
    this.resetParticleStates()

    switch (step.type) {
      case 'compare':
        step.indices.forEach((index: number) => {
          this.particles[index].isComparing = true
        })
        break
      case 'swap':
        this.swapParticles(step.indices[0], step.indices[1])
        break
      case 'active':
        this.particles[step.index].isActive = true
        break
      case 'pivot':
        // Highlight pivot element for quick sort
        this.particles[step.index].isActive = true
        break
      case 'place':
        // For merge sort - update particle value at specific position
        if (step.index !== undefined && step.value !== undefined) {
          const particle = this.particles[step.index]
          particle.value = step.value
          particle.color = this.getParticleColor(step.value, step.index)
          particle.isActive = true

          // Update all particle positions with new dynamic scaling
          this.calculateParticlePositions()
        }
        break
      case 'sorted':
        // Mark as sorted (could add visual indicator)
        break
      case 'complete':
        this.isRunning = false
        this.parameters.isRunning = false
        this.parameters.isPaused = false
        break
    }

    this.currentStep++
  }

  private resetParticleStates(): void {
    this.particles.forEach(particle => {
      particle.isComparing = false
      particle.isSwapping = false
      particle.isActive = false
    })
  }

  private swapParticles(i: number, j: number): void {
    const particle1 = this.particles[i]
    const particle2 = this.particles[j]

    particle1.isSwapping = true
    particle2.isSwapping = true

    // Swap target positions
    const tempX = particle1.targetX
    particle1.targetX = particle2.targetX
    particle2.targetX = tempX

    // Swap particles in array
    ;[this.particles[i], this.particles[j]] = [this.particles[j], this.particles[i]]
  }

  handleInteraction(event: InteractionEvent): void {
    // Click to start/pause animation
    if (event.type === 'mouse' && event.position && !event.delta) {
      if (this.isRunning) {
        this.isPaused = !this.isPaused
      } else {
        this.startAnimation()
      }
    }
  }

  private restoreOriginalArray(): void {
    // Restore particles to their original unsorted state
    this.particles.forEach((particle, index) => {
      if (index < this.originalValues.length) {
        particle.value = this.originalValues[index]
        particle.color = this.getParticleColor(particle.value, index)
      }
    })
    this.calculateParticlePositions()
    this.resetParticleStates()
  }

  private startAnimation(): void {
    // Restore original array state before generating steps
    this.restoreOriginalArray()

    // Generate sorting steps based on the original unsorted array
    this.generateSortingSteps()
    this.isRunning = true
    this.isPaused = false
    this.lastStepTime = 0
    this.currentStep = 0

    // Update parameters to reflect state change
    this.parameters.isRunning = true
    this.parameters.isPaused = false
    this.onParameterChange('isRunning', true)
    this.onParameterChange('isPaused', false)
  }

  private stopAnimation(): void {
    this.isRunning = false
    this.isPaused = false
    this.currentStep = 0
    this.resetParticleStates()

    // Update parameters to reflect state change
    this.parameters.isRunning = false
    this.parameters.isPaused = false
  }

  getControls(): VisualizationControl[] {
    return [
      {
        id: 'algorithm',
        label: 'Algorithm',
        type: 'select',
        value: this.parameters.algorithm,
        options: this.algorithms.map(a => ({ label: a.name, value: a.id })),
        onChange: (value) => {
          this.setParameter('algorithm', value)
          this.resetAnimation()
        }
      },
      {
        id: 'arraySize',
        label: 'Array Size',
        type: 'slider',
        value: this.parameters.arraySize,
        min: 10,
        max: 100,
        step: 5,
        onChange: (value) => {
          this.setParameter('arraySize', value)
          this.generateRandomArray()
        }
      },
      {
        id: 'animationSpeed',
        label: 'Animation Speed (ms)',
        type: 'slider',
        value: this.parameters.animationSpeed,
        min: 10,
        max: 200,
        step: 10,
        onChange: (value) => this.setParameter('animationSpeed', value)
      },
      {
        id: 'colorScheme',
        label: 'Color Scheme',
        type: 'select',
        value: this.parameters.colorScheme,
        options: [
          { label: 'Rainbow', value: 'rainbow' },
          { label: 'Gradient', value: 'gradient' },
          { label: 'Monochrome', value: 'monochrome' }
        ],
        onChange: (value) => {
          this.setParameter('colorScheme', value)
          this.generateRandomArray()
        }
      },
      {
        id: 'start',
        label: this.parameters.isRunning ? (this.parameters.isPaused ? 'Resume' : 'Pause') : 'Start',
        type: 'button',
        value: null,
        onChange: () => {
          if (this.isRunning) {
            this.isPaused = !this.isPaused
            this.parameters.isPaused = this.isPaused
            this.onParameterChange('isPaused', this.isPaused)
          } else {
            this.startAnimation()
          }
        }
      },
      {
        id: 'stop',
        label: 'Stop',
        type: 'button',
        value: null,
        onChange: () => this.stopAnimation()
      },
      {
        id: 'shuffle',
        label: 'Shuffle Array',
        type: 'button',
        value: null,
        onChange: () => this.generateRandomArray()
      }
    ]
  }

  protected onParameterChange(key: string, value: any): void {
    // Handle parameter changes immediately
    if (key === 'arraySize') {
      // Regenerate array with new size
      this.generateRandomArray()
    } else if (key === 'colorScheme') {
      // Update particle colors
      this.particles.forEach((particle, index) => {
        particle.color = this.getParticleColor(particle.value, index)
      })
    } else if (key === 'algorithm') {
      // Reset animation when algorithm changes
      this.resetAnimation()
    }
    // For other parameters like animationSpeed, no immediate visual change needed
  }

  protected onReset(): void {
    this.generateRandomArray()
  }
}
