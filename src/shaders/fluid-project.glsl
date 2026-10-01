#version 300 es
precision highp float;
precision highp sampler2D;

// Project: subtract the slope of the pressure from the velocity. What is left
// flows around itself without piling up anywhere.
uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform vec2 uTexel;

in vec2 vUv;
out vec4 result;

void main() {
  vec2 x = vec2(uTexel.x, 0.0), y = vec2(0.0, uTexel.y);
  vec2 slope = 0.5 * vec2(
    texture(uPressure, vUv + x).x - texture(uPressure, vUv - x).x,
    texture(uPressure, vUv + y).x - texture(uPressure, vUv - y).x);
  result = vec4(texture(uVelocity, vUv).xy - slope, 0.0, 1.0);
}
