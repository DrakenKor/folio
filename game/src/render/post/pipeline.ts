// The frame: one multisampled scene pass with cel outlines and a glow target,
// bloom on the glow target only, then a painterly grade before tone mapping.
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer } from 'three/webgpu'
import { dot, float, mix, mrt, output, screenUV, smoothstep, uniform, vec3, vec4 } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { inkWidth } from '../materials/cel'
import { celOutlinePass } from './outline'

export function createPost(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
  const uniforms = {
    outlineWidth: inkWidth,
    bloomStrength: uniform(0.65),
    bloomRadius: uniform(0.55),
    saturation: uniform(1.04),
    vignette: uniform(0.08)
  }

  const scenePass = celOutlinePass(scene, camera, uniforms.outlineWidth)
  // `glow` collects what may bloom: emissives and the sun. Materials opt in via mrtNode.
  scenePass.setMRT(mrt({ output, glow: vec4(0, 0, 0, 1) }))
  const sceneColor = scenePass.getTextureNode('output')
  const glow = scenePass.getTextureNode('glow')

  const bloomPass = bloom(glow, 1, 0.5, 0.85)
  bloomPass.strength = uniforms.bloomStrength
  bloomPass.radius = uniforms.bloomRadius

  let rgb = sceneColor.rgb.add(bloomPass.rgb).mul(1.08)
  // One gentle grade; NeutralToneMapping supplies the highlight shoulder.
  const luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722))
  rgb = mix(vec3(luma), rgb, uniforms.saturation)
  rgb = rgb.add(vec3(0.002, 0.0025, 0.005).mul(rgb.max(0).oneMinus().max(0)))
  const edge = screenUV.sub(0.5).length()
  rgb = rgb.mul(float(1).sub(smoothstep(0.35, 0.85, edge).mul(uniforms.vignette)))

  const pipeline = new RenderPipeline(renderer, vec4(rgb, 1))

  return {
    pipeline,
    scenePass,
    uniforms,
    render() {
      pipeline.render()
    },
    dispose() {
      pipeline.dispose()
      scenePass.dispose()
      bloomPass.dispose()
    }
  }
}
