#version 300 es
precision highp float;
precision highp sampler2D;

// Pressure: one Jacobi iteration. Each cell's pressure becomes the average of
// its four neighbours, less the divergence there. Run 20 times a frame, each
// run reading the last one's answer.
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;

in vec2 vUv;
out vec4 result;

void main() {
  vec2 x = vec2(uTexel.x, 0.0), y = vec2(0.0, uTexel.y);
  float around = texture(uPressure, vUv - x).x + texture(uPressure, vUv + x).x
    + texture(uPressure, vUv - y).x + texture(uPressure, vUv + y).x;
  float divergence = texture(uDivergence, vUv).x;
  result = vec4(0.25 * (around - divergence), 0.0, 0.0, 1.0);
}
