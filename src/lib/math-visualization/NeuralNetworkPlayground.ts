import { BaseMathVisualization } from './BaseMathVisualization'
import { InteractionEvent, VisualizationControl } from '../../types/math-visualization'

interface Neuron {
  id: string
  x: number
  y: number
  value: number
  bias: number
  layer: number
  index: number
  activation: number
  isActive: boolean
}

interface Connection {
  from: string
  to: string
  weight: number
  isActive: boolean
}

interface TrainingData {
  inputs: number[]
  outputs: number[]
}

export class NeuralNetworkPlayground extends BaseMathVisualization {
  private neurons: Neuron[] = []
  private connections: Connection[] = []
  private layers: number[] = [2, 4, 3, 1] // Default network structure
  private isTraining = false
  private trainingData: TrainingData[] = []
  private currentEpoch = 0
  private learningRate = 0.1
  private selectedNeuron: Neuron | null = null
  private selectedConnection: Connection | null = null

  constructor() {
    super(
      'neural-network-playground',
      'Neural Network Playground',
      'Build and train neural networks with interactive topology editing and real-time visualization',
      'neural'
    )
  }

  protected setupDefaultParameters(): void {
    this.parameters = {
      learningRate: 0.1,
      activationFunction: 'sigmoid',
      networkStructure: '2,4,3,1',
      trainingSpeed: 50,
      showWeights: true,
      showBiases: true,
      showActivations: true,
      datasetType: 'xor'
    }
  }

  protected async initializeVisualization(): Promise<void> {
    this.generateNetwork()
    this.generateTrainingData()
  }

  private generateNetwork(): void {
    this.neurons = []
    this.connections = []

    const structure = this.parameters.networkStructure.split(',').map(Number)
    this.layers = structure

    const { width, height } = this.getCanvasSize()
    const layerSpacing = (width - 100) / (structure.length - 1)

    // Create neurons
    structure.forEach((layerSize: number, layerIndex: number) => {
      const neuronSpacing = (height - 100) / (layerSize + 1)

      for (let i = 0; i < layerSize; i++) {
        const neuron: Neuron = {
          id: `${layerIndex}-${i}`,
          x: 50 + layerIndex * layerSpacing,
          y: 50 + (i + 1) * neuronSpacing,
          value: 0,
          bias: (Math.random() - 0.5) * 2,
          layer: layerIndex,
          index: i,
          activation: 0,
          isActive: false
        }
        this.neurons.push(neuron)
      }
    })

    // Create connections
    for (let layerIndex = 0; layerIndex < structure.length - 1; layerIndex++) {
      const currentLayer = this.neurons.filter(n => n.layer === layerIndex)
      const nextLayer = this.neurons.filter(n => n.layer === layerIndex + 1)

      currentLayer.forEach(fromNeuron => {
        nextLayer.forEach(toNeuron => {
          const connection: Connection = {
            from: fromNeuron.id,
            to: toNeuron.id,
            weight: (Math.random() - 0.5) * 2,
            isActive: false
          }
          this.connections.push(connection)
        })
      })
    }
  }

  private generateTrainingData(): void {
    this.trainingData = []

    switch (this.parameters.datasetType) {
      case 'xor':
        this.trainingData = [
          { inputs: [0, 0], outputs: [0] },
          { inputs: [0, 1], outputs: [1] },
          { inputs: [1, 0], outputs: [1] },
          { inputs: [1, 1], outputs: [0] }
        ]
        break
      case 'and':
        this.trainingData = [
          { inputs: [0, 0], outputs: [0] },
          { inputs: [0, 1], outputs: [0] },
          { inputs: [1, 0], outputs: [0] },
          { inputs: [1, 1], outputs: [1] }
        ]
        break
      case 'or':
        this.trainingData = [
          { inputs: [0, 0], outputs: [0] },
          { inputs: [0, 1], outputs: [1] },
          { inputs: [1, 0], outputs: [1] },
          { inputs: [1, 1], outputs: [1] }
        ]
        break
      case 'circle':
        // Generate circular classification data
        for (let i = 0; i < 100; i++) {
          const x = (Math.random() - 0.5) * 2
          const y = (Math.random() - 0.5) * 2
          const distance = Math.sqrt(x * x + y * y)
          this.trainingData.push({
            inputs: [x, y],
            outputs: [distance < 0.5 ? 1 : 0]
          })
        }
        break
    }
  }

  private activationFunction(x: number): number {
    switch (this.parameters.activationFunction) {
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x))
      case 'tanh':
        return Math.tanh(x)
      case 'relu':
        return Math.max(0, x)
      case 'leaky_relu':
        return x > 0 ? x : 0.01 * x
      default:
        return 1 / (1 + Math.exp(-x))
    }
  }

  private activationDerivative(x: number): number {
    switch (this.parameters.activationFunction) {
      case 'sigmoid':
        const sigmoid = this.activationFunction(x)
        return sigmoid * (1 - sigmoid)
      case 'tanh':
        const tanh = this.activationFunction(x)
        return 1 - tanh * tanh
      case 'relu':
        return x > 0 ? 1 : 0
      case 'leaky_relu':
        return x > 0 ? 1 : 0.01
      default:
        const sig = this.activationFunction(x)
        return sig * (1 - sig)
    }
  }

  private forwardPass(inputs: number[]): number[] {
    // Set input layer
    const inputNeurons = this.neurons.filter(n => n.layer === 0)
    inputNeurons.forEach((neuron, index) => {
      neuron.value = inputs[index] || 0
      neuron.activation = neuron.value
    })

    // Forward propagation
    for (let layerIndex = 1; layerIndex < this.layers.length; layerIndex++) {
      const currentLayer = this.neurons.filter(n => n.layer === layerIndex)

      currentLayer.forEach(neuron => {
        let sum = neuron.bias

        // Sum weighted inputs
        this.connections
          .filter(c => c.to === neuron.id)
          .forEach(connection => {
            const fromNeuron = this.neurons.find(n => n.id === connection.from)
            if (fromNeuron) {
              sum += fromNeuron.activation * connection.weight
            }
          })

        neuron.value = sum
        neuron.activation = this.activationFunction(sum)
      })
    }

    // Return output layer activations
    const outputLayer = this.neurons.filter(n => n.layer === this.layers.length - 1)
    return outputLayer.map(n => n.activation)
  }

  private trainStep(): void {
    if (this.trainingData.length === 0) return

    const data = this.trainingData[Math.floor(Math.random() * this.trainingData.length)]
    const outputs = this.forwardPass(data.inputs)

    // Backpropagation
    this.backpropagate(data.outputs, outputs)
    this.currentEpoch++
  }

  private backpropagate(targetOutputs: number[], actualOutputs: number[]): void {
    const neuronErrors = new Map<string, number>()

    // Calculate output layer errors
    const outputLayer = this.neurons.filter(n => n.layer === this.layers.length - 1)
    outputLayer.forEach((neuron, index) => {
      const error = targetOutputs[index] - actualOutputs[index]
      const derivative = this.activationDerivative(neuron.value)
      neuronErrors.set(neuron.id, error * derivative)
    })

    // Backpropagate errors
    for (let layerIndex = this.layers.length - 2; layerIndex >= 0; layerIndex--) {
      const currentLayer = this.neurons.filter(n => n.layer === layerIndex)

      currentLayer.forEach(neuron => {
        let error = 0

        // Sum errors from next layer
        this.connections
          .filter(c => c.from === neuron.id)
          .forEach(connection => {
            const nextNeuronError = neuronErrors.get(connection.to) || 0
            error += nextNeuronError * connection.weight
          })

        const derivative = this.activationDerivative(neuron.value)
        neuronErrors.set(neuron.id, error * derivative)
      })
    }

    // Update weights and biases
    this.connections.forEach(connection => {
      const fromNeuron = this.neurons.find(n => n.id === connection.from)
      const toNeuronError = neuronErrors.get(connection.to) || 0

      if (fromNeuron) {
        connection.weight += this.parameters.learningRate * toNeuronError * fromNeuron.activation
      }
    })

    this.neurons.forEach(neuron => {
      if (neuron.layer > 0) {
        const error = neuronErrors.get(neuron.id) || 0
        neuron.bias += this.parameters.learningRate * error
      }
    })
  }

  update(deltaTime: number): void {
    if (!this.ctx || !this.canvas) return

    this.clearCanvas()
    this.drawNetwork()
    this.drawInfo()

    // Training step
    if (this.isTraining) {
      this.trainStep()
    }
  }

  private drawNetwork(): void {
    if (!this.ctx) return

    // Draw connections
    this.connections.forEach(connection => {
      const fromNeuron = this.neurons.find(n => n.id === connection.from)
      const toNeuron = this.neurons.find(n => n.id === connection.to)

      if (fromNeuron && toNeuron) {
        this.ctx!.strokeStyle = connection.weight > 0 ? '#4ade80' : '#ef4444'
        this.ctx!.lineWidth = Math.abs(connection.weight) * 2 + 0.5
        this.ctx!.globalAlpha = connection.isActive ? 1 : 0.6

        this.ctx!.beginPath()
        this.ctx!.moveTo(fromNeuron.x, fromNeuron.y)
        this.ctx!.lineTo(toNeuron.x, toNeuron.y)
        this.ctx!.stroke()

        // Draw weight if enabled
        if (this.parameters.showWeights) {
          const midX = (fromNeuron.x + toNeuron.x) / 2
          const midY = (fromNeuron.y + toNeuron.y) / 2

          this.ctx!.fillStyle = '#ffffff'
          this.ctx!.font = '8px Arial'
          this.ctx!.textAlign = 'center'
          this.ctx!.fillText(connection.weight.toFixed(2), midX, midY)
        }
      }
    })

    this.ctx.globalAlpha = 1

    // Draw neurons
    this.neurons.forEach(neuron => {
      const radius = 15

      // Neuron circle
      this.ctx!.fillStyle = neuron.isActive ? '#fbbf24' : '#3b82f6'
      if (this.parameters.showActivations) {
        const intensity = Math.max(0, Math.min(1, neuron.activation))
        this.ctx!.fillStyle = `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`
      }

      this.ctx!.beginPath()
      this.ctx!.arc(neuron.x, neuron.y, radius, 0, 2 * Math.PI)
      this.ctx!.fill()

      // Neuron border
      this.ctx!.strokeStyle = neuron === this.selectedNeuron ? '#fbbf24' : '#1e293b'
      this.ctx!.lineWidth = 2
      this.ctx!.stroke()

      // Activation value
      this.ctx!.fillStyle = '#ffffff'
      this.ctx!.font = '10px Arial'
      this.ctx!.textAlign = 'center'
      this.ctx!.fillText(neuron.activation.toFixed(2), neuron.x, neuron.y + 3)

      // Bias if enabled
      if (this.parameters.showBiases && neuron.layer > 0) {
        this.ctx!.fillStyle = '#94a3b8'
        this.ctx!.font = '8px Arial'
        this.ctx!.fillText(`b:${neuron.bias.toFixed(2)}`, neuron.x, neuron.y + radius + 12)
      }
    })
  }

  private drawInfo(): void {
    if (!this.ctx) return

    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '14px Arial'
    this.ctx.textAlign = 'left'
    this.ctx.fillText(`Epoch: ${this.currentEpoch}`, 20, 30)
    this.ctx.fillText(`Learning Rate: ${this.parameters.learningRate}`, 20, 50)
    this.ctx.fillText(`Dataset: ${this.parameters.datasetType.toUpperCase()}`, 20, 70)
    this.ctx.fillText(`Status: ${this.isTraining ? 'Training' : 'Stopped'}`, 200, 30)

    // Network structure
    this.ctx.fillText(`Structure: ${this.layers.join(' → ')}`, 200, 50)
  }

  handleInteraction(event: InteractionEvent): void {
    if (event.type === 'mouse' && event.position) {
      // Check if clicking on a neuron
      const clickedNeuron = this.neurons.find(neuron => {
        const distance = Math.sqrt(
          Math.pow(event.position!.x - neuron.x, 2) +
          Math.pow(event.position!.y - neuron.y, 2)
        )
        return distance <= 15
      })

      if (clickedNeuron) {
        this.selectedNeuron = this.selectedNeuron === clickedNeuron ? null : clickedNeuron
        clickedNeuron.isActive = !clickedNeuron.isActive
      } else {
        this.selectedNeuron = null
      }
    }
  }

  private startTraining(): void {
    this.isTraining = true
    this.currentEpoch = 0
  }

  private stopTraining(): void {
    this.isTraining = false
  }

  private resetNetwork(): void {
    this.generateNetwork()
    this.currentEpoch = 0
    this.isTraining = false
  }

  getControls(): VisualizationControl[] {
    return [
      {
        id: 'networkStructure',
        label: 'Network Structure (comma-separated)',
        type: 'select',
        value: this.parameters.networkStructure,
        options: [
          { label: '2,4,3,1 (Default)', value: '2,4,3,1' },
          { label: '2,3,1 (Simple)', value: '2,3,1' },
          { label: '2,5,5,1 (Deep)', value: '2,5,5,1' },
          { label: '2,8,4,1 (Wide)', value: '2,8,4,1' }
        ],
        onChange: (value) => {
          this.setParameter('networkStructure', value)
          this.generateNetwork()
        }
      },
      {
        id: 'learningRate',
        label: 'Learning Rate',
        type: 'slider',
        value: this.parameters.learningRate,
        min: 0.01,
        max: 1,
        step: 0.01,
        onChange: (value) => this.setParameter('learningRate', value)
      },
      {
        id: 'activationFunction',
        label: 'Activation Function',
        type: 'select',
        value: this.parameters.activationFunction,
        options: [
          { label: 'Sigmoid', value: 'sigmoid' },
          { label: 'Tanh', value: 'tanh' },
          { label: 'ReLU', value: 'relu' },
          { label: 'Leaky ReLU', value: 'leaky_relu' }
        ],
        onChange: (value) => this.setParameter('activationFunction', value)
      },
      {
        id: 'datasetType',
        label: 'Dataset',
        type: 'select',
        value: this.parameters.datasetType,
        options: [
          { label: 'XOR', value: 'xor' },
          { label: 'AND', value: 'and' },
          { label: 'OR', value: 'or' },
          { label: 'Circle Classification', value: 'circle' }
        ],
        onChange: (value) => {
          this.setParameter('datasetType', value)
          this.generateTrainingData()
        }
      },
      {
        id: 'showWeights',
        label: 'Show Weights',
        type: 'toggle',
        value: this.parameters.showWeights,
        onChange: (value) => this.setParameter('showWeights', value)
      },
      {
        id: 'showBiases',
        label: 'Show Biases',
        type: 'toggle',
        value: this.parameters.showBiases,
        onChange: (value) => this.setParameter('showBiases', value)
      },
      {
        id: 'showActivations',
        label: 'Show Activations',
        type: 'toggle',
        value: this.parameters.showActivations,
        onChange: (value) => this.setParameter('showActivations', value)
      },
      {
        id: 'train',
        label: this.isTraining ? 'Stop Training' : 'Start Training',
        type: 'button',
        value: null,
        onChange: () => {
          if (this.isTraining) {
            this.stopTraining()
          } else {
            this.startTraining()
          }
        }
      },
      {
        id: 'reset',
        label: 'Reset Network',
        type: 'button',
        value: null,
        onChange: () => this.resetNetwork()
      }
    ]
  }

  protected onReset(): void {
    this.resetNetwork()
  }
}
