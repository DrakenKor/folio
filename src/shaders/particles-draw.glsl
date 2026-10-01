#version 300 es
precision highp float;

layout(location = 0) in vec4 a_state;
layout(location = 1) in vec2 a_home;
layout(location = 2) in float a_seed;

uniform float u_aspect;
uniform float u_size;
uniform float u_alpha;
uniform int u_palette; // 0 bone, 1 velocity, 2 spectrum
uniform vec3 u_bone;
uniform vec3 u_teal;
uniform vec3 u_amber;
uniform vec3 u_pink;

out vec3 v_color;

vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}

void main() {
  vec3 color = u_bone;
  if (u_palette == 1) {
    float t = smoothstep(0.05, 1.2, length(a_state.zw)) * 3.0;
    color = t < 1.0 ? mix(u_bone, u_teal, t) : t < 2.0 ? mix(u_teal, u_amber, t - 1.0) : mix(u_amber, u_pink, min(t - 2.0, 1.0));
  } else if (u_palette == 2) {
    color = hsv(atan(a_home.y, a_home.x) / 6.2831853 + length(a_home) * 0.3, 0.55, 0.95);
  }
  v_color = color * u_alpha * (0.7 + 0.6 * a_seed);
  gl_Position = vec4(a_state.x / u_aspect, a_state.y, 0.0, 1.0);
  gl_PointSize = u_size;
}
