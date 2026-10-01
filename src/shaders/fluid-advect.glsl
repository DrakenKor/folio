#version 300 es
precision highp float;
precision highp sampler2D;

// Advect: a semi-Lagrangian backtrace. Each cell follows the velocity
// backwards for one step and takes whatever was there. Runs twice a frame:
// once to carry the velocity field along itself, once to carry the dye.
uniform sampler2D uVelocity;
uniform sampler2D uSource;
// Cells across the velocity grid; velocity is stored in cells per second
uniform vec2 uGrid;
// One cell of the source, in uv
uniform vec2 uTexel;
uniform float uDt;
uniform bool uDye;
uniform float viscosity; // @slider 0 1 0.15
uniform float dyeFade; // @slider 0 3 0.3

in vec2 vUv;
out vec4 result;

void main() {
  vec2 from = vUv - uDt * texture(uVelocity, vUv).xy / uGrid;
  vec4 value = texture(uSource, from);
  if (uDye) {
    result = value / (1.0 + dyeFade * uDt);
    return;
  }
  // Viscosity: momentum spreads to the four neighbours. The rate is capped
  // below a quarter, past which this explicit step would oscillate.
  vec2 x = vec2(uTexel.x, 0.0), y = vec2(0.0, uTexel.y);
  vec4 around = texture(uSource, vUv + x) + texture(uSource, vUv - x)
    + texture(uSource, vUv + y) + texture(uSource, vUv - y);
  float spread = min(0.24, viscosity * 12.0 * uDt);
  value += spread * (around - 4.0 * texture(uSource, vUv));
  result = value / (1.0 + 0.2 * uDt);
}
