#version 300 es
precision mediump float;

in vec3 v_color;
out vec4 color;

// A circular sprite with a soft edge
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.4, 1.0, d);
  color = vec4(v_color * a, 1.0);
}
