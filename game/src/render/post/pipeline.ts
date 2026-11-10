// The frame: one multisampled scene pass with cel outlines and a glow target,
// bloom on the glow target only, then a painterly grade before tone mapping.
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer } from 'three/webgpu'
import { color, dot, float, mix, mrt, output, screenUV, smoothstep, uniform, vec3, vec4 } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { celOutlinePass } from './outline'

export function createPost(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
  const uniforms = {
    outlineWidth: uniform(2.1),
    bloomStrength: uniform(0.9),
    bloomRadius: uniform(0.55),
    saturation: uniform(1.08),
    vignette: uniform(0.22)
  }

  const scenePass = celOutlinePass(scene, camera, uniforms.outlineWidth)
  // `glow` collects what may bloom: emissives and the sun. Materials opt in via mrtNode.
  scenePass.setMRT(mrt({ output, glow: vec4(0, 0, 0, 1) }))
  const sceneColor = scenePass.getTextureNode('output')
  const glow = scenePass.getTextureNode('glow')

  const bloomPass = bloom(glow, 1, 0.5, 0)
  bloomPass.strength = uniforms.bloomStrength
  bloomPass.radius = uniforms.bloomRadius

  let rgb = sceneColor.rgb.add(bloomPass.rgb)
  // Grade: gentle saturation, cool shadows and warm highlights, soft vignette.
  const luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722))
  rgb = mix(vec3(luma), rgb, uniforms.saturation)
  const shadowTint = color('#5d6fb0')
  const lightTint = color('#ffe7c4')
  rgb = rgb.mul(mix(mix(vec3(1), shadowTint.mul(1.6), float(0.3)), vec3(1), smoothstep(0.03, 0.45, luma)))
  rgb = rgb.mul(mix(vec3(1), lightTint, smoothstep(0.45, 1.2, luma).mul(0.12)))
  const edge = screenUV.sub(0.5).length()
  rgb = rgb.mul(float(1).sub(smoothstep(0.35, 0.85, edge).mul(uniforms.vignette)))

  const pipeline = new RenderPipeline(renderer, vec4(rgb, 1))

  return {
    pipeline,
    scenePass,
    uniforms,
    render() {
      pipeline.render()
    }
  }
}
