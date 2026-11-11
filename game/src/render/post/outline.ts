// Inverted-hull outlines for cel materials, drawn inside the scene pass.
//
// Based on three's ToonOutlinePassNode, which draws one colour for every
// object and ignores each material's positionNode. This pass takes the colour
// and hull normal from each CelMaterial and reuses its positionNode, so
// swaying trees keep their outline attached. Width is in physical pixels and
// thins with distance.
import { BackSide, type Camera, type Material, NodeMaterial, PassNode, type Scene, type NodeBuilder, type UniformNode } from 'three/webgpu'
import { cameraProjectionMatrix, modelViewMatrix, normalLocal, positionLocal, screenSize, vec4 } from 'three/tsl'
import { type CelMaterial, inkPixels, inkWidth, isCelMaterial } from '../materials/cel'

type RenderObjectFunction = Parameters<import('three/webgpu').Renderer['setRenderObjectFunction']>[0]

/** Supplies smooth hull normals before three applies the mesh's skinning. */
class InkMaterial extends NodeMaterial {
  constructor(private readonly source: CelMaterial) { super() }

  override setupPosition(builder: NodeBuilder) {
    if (this.source.outlineNormal) normalLocal.assign(this.source.outlineNormal)
    return super.setupPosition(builder)
  }
}

export class CelOutlinePassNode extends PassNode {
  private readonly outlineMaterials = new WeakMap<Material, NodeMaterial>()

  constructor(
    scene: Scene,
    camera: Camera,
    /** Outline width in physical pixels at close range. */
    readonly width: UniformNode<'float', number>
  ) {
    super(PassNode.COLOR, scene, camera)
    this.name = 'Cel Outline Pass'
  }

  override updateBefore(frame: Parameters<PassNode['updateBefore']>[0]) {
    const { renderer } = frame
    if (!renderer) return super.updateBefore(frame)
    const previous = renderer.getRenderObjectFunction()
    const draw: RenderObjectFunction = (object, scene, camera, geometry, material, group, lightsNode, clippingContext) => {
      if (isCelMaterial(material) && material.outline && material.outlineWidth > 0 && !material.wireframe) {
        renderer.renderObject(object, scene, camera, geometry, this.outlineMaterial(material), group, lightsNode, clippingContext)
      }
      renderer.renderObject(object, scene, camera, geometry, material, group, lightsNode, clippingContext)
    }
    renderer.setRenderObjectFunction(draw)
    const result = super.updateBefore(frame)
    renderer.setRenderObjectFunction(previous)
    return result
  }

  private outlineMaterial(source: CelMaterial): NodeMaterial {
    let material = this.outlineMaterials.get(source)
    if (material) return material
    material = new InkMaterial(source)
    material.name = `${source.name || 'cel'}_outline`
    material.side = BackSide
    material.positionNode = source.positionNode
    material.opacityNode = source.opacityNode
    material.transparent = source.transparent
    const mvp = cameraProjectionMatrix.mul(modelViewMatrix)
    const clip = mvp.mul(vec4(positionLocal, 1)).toVar()
    const clipAlong = mvp.mul(vec4(positionLocal.add(normalLocal.mul(0.05)), 1))
    // Screen-space direction of the normal, in physical pixels.
    const ndc = clip.xy.div(clip.w)
    const ndcAlong = clipAlong.xy.div(clipAlong.w)
    const projected = ndcAlong.sub(ndc).mul(screenSize)
    const dir = projected.div(projected.length().max(1e-5))
    const px = inkPixels(clip.w).mul(this.width.div(inkWidth)).mul(source.outlineWidth)
    const offset = dir.mul(px).mul(2).div(screenSize)
    material.vertexNode = vec4(clip.xy.add(offset.mul(clip.w)), clip.z, clip.w)
    material.colorNode = vec4(source.inkColor(), 1)
    material.fog = true
    const outline = material
    source.addEventListener('dispose', () => outline.dispose())
    this.outlineMaterials.set(source, material)
    return material
  }
}

export function celOutlinePass(scene: Scene, camera: Camera, width: UniformNode<'float', number>) {
  return new CelOutlinePassNode(scene, camera, width)
}
