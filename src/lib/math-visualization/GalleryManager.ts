import { GalleryHost, MathVisualization } from '@/types/math-visualization'

/**
 * The gallery's register of exhibits, and the one on stage. Switching cleans
 * up the exhibit being left and initialises the one arriving on the canvas
 * its renderer asks for.
 */
export class GalleryManager {
  private visualizations = new Map<string, MathVisualization>()
  private current: MathVisualization | null = null

  registerVisualization(visualization: MathVisualization): void {
    this.visualizations.set(visualization.id, visualization)
  }

  unregisterVisualization(id: string): void {
    const visualization = this.visualizations.get(id)
    if (!visualization) return
    if (visualization === this.current) this.cleanup()
    this.visualizations.delete(id)
  }

  getVisualization(id: string): MathVisualization | undefined {
    return this.visualizations.get(id)
  }

  // In the order they were registered, which is the order of the tabs
  getAllVisualizations(): MathVisualization[] {
    return Array.from(this.visualizations.values())
  }

  get active(): MathVisualization | null {
    return this.current
  }

  async activate(id: string, host: GalleryHost): Promise<MathVisualization> {
    const next = this.visualizations.get(id)
    if (!next) throw new Error(`Unknown exhibit "${id}"`)
    if (next === this.current) return next
    this.current?.cleanup()
    this.current = next
    await next.initialize(host.canvases[next.renderer], host)
    return next
  }

  // Takes the exhibit off stage. The register is kept.
  cleanup(): void {
    this.current?.cleanup()
    this.current = null
  }
}
