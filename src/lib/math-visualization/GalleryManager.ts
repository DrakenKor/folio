import { MathVisualization, GallerySection } from '@/types/math-visualization'

export class GalleryManager {
  private sections: GallerySection[] = []
  private visualizations: Map<string, MathVisualization> = new Map()

  constructor() {
    this.initializeSections()
  }

  private initializeSections(): void {
    this.sections = [
      {
        id: 'fourier',
        title: 'Fourier Analysis',
        description: 'Interactive Fourier transform visualizations',
        icon: '〜',
        visualizations: []
      },
      {
        id: 'fractal',
        title: 'Fractal Explorer',
        description: 'Explore mathematical fractals',
        icon: '❋',
        visualizations: []
      },
      {
        id: 'algorithm',
        title: 'Algorithm Visualization',
        description: 'See algorithms in action',
        icon: '⚡',
        visualizations: []
      },
      {
        id: 'neural',
        title: 'Neural Networks',
        description: 'Interactive neural network playground',
        icon: '🧠',
        visualizations: []
      }
    ]
  }

  registerVisualization(visualization: MathVisualization): void {
    this.visualizations.set(visualization.id, visualization)

    // Add to appropriate section
    const section = this.sections.find(s => s.id === visualization.category)
    if (section) {
      section.visualizations.push(visualization)
    }
  }

  unregisterVisualization(id: string): void {
    const visualization = this.visualizations.get(id)
    if (visualization) {
      // Remove from section
      const section = this.sections.find(s => s.id === visualization.category)
      if (section) {
        section.visualizations = section.visualizations.filter(v => v.id !== id)
      }

      // Clean up visualization
      visualization.cleanup()
      this.visualizations.delete(id)
    }
  }

  getVisualization(id: string): MathVisualization | undefined {
    return this.visualizations.get(id)
  }

  getSections(): GallerySection[] {
    return this.sections
  }

  getVisualizationsByCategory(category: string): MathVisualization[] {
    const section = this.sections.find(s => s.id === category)
    return section ? section.visualizations : []
  }

  getAllVisualizations(): MathVisualization[] {
    return Array.from(this.visualizations.values())
  }

  cleanup(): void {
    this.visualizations.forEach(viz => viz.cleanup())
    this.visualizations.clear()
    this.sections.forEach(section => {
      section.visualizations = []
    })
  }
}
