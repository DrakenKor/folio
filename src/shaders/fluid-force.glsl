#version 300 es
precision highp float;
precision highp sampler2D;

// Add force: a soft-edged splat where the pointer moved. On the velocity
// field it adds the pointer's own velocity; on the dye it adds ink. The
// velocity version also adds vorticity confinement, which feeds the small
// whirls that advection would otherwise blur away.
uniform sampler2D uTarget;
uniform vec2 uTexel;
uniform vec2 uPoint;
// What the splat adds at its centre: a velocity, or an amount of dye in x
uniform vec2 uPush;
uniform float uAspect;
uniform float uRadius;
uniform float uDt;
uniform bool uDye;
uniform float force; // @slider 0 3 1
uniform float curl; // @slider 0 40 12

in vec2 vUv;
out vec4 result;

// How fast the fluid is turning about this cell
float curlAt(vec2 uv) {
  vec2 x = vec2(uTexel.x, 0.0), y = vec2(0.0, uTexel.y);
  return 0.5 * (texture(uTarget, uv + x).y - texture(uTarget, uv - x).y
    - texture(uTarget, uv + y).x + texture(uTarget, uv - y).x);
}

void main() {
  vec2 offset = vUv - uPoint;
  offset.x *= uAspect;
  float splat = exp(-dot(offset, offset) / uRadius);
  vec4 value = texture(uTarget, vUv);
  if (uDye) {
    result = value + splat * uPush.x;
    return;
  }
  value.xy += splat * force * uPush;

  // Push along the edge of each whirl, towards where the turning is stronger
  vec2 x = vec2(uTexel.x, 0.0), y = vec2(0.0, uTexel.y);
  vec2 towards = vec2(
    abs(curlAt(vUv + x)) - abs(curlAt(vUv - x)),
    abs(curlAt(vUv + y)) - abs(curlAt(vUv - y)));
  towards /= length(towards) + 0.0001;
  value.xy += curl * uDt * curlAt(vUv) * vec2(towards.y, -towards.x);
  result = value;
}
