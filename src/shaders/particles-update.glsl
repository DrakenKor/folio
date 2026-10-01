#version 300 es
// One simulation step. Reads a point's state, writes the next one through
// transform feedback. Units: the stage is 2 tall, y up, x scaled by aspect.
precision highp float;

layout(location = 0) in vec4 a_state; // position.xy, velocity.zw
layout(location = 1) in vec2 a_home;
layout(location = 2) in float a_seed;

uniform float u_dt;
uniform float u_time;
uniform float u_spring;
uniform float u_flow;
uniform float u_drag;
uniform float u_reach;
uniform float u_pointerSign; // +1 push, -1 pull, 0 off
uniform float u_fit;
uniform vec2 u_center;
uniform vec2 u_bounds;
uniform int u_pointerCount;
uniform vec2 u_pointers[5];
uniform float u_scatter;
uniform vec2 u_scatterCenter;

out vec4 v_state;

// 2D simplex noise, Ashima Arts / Stefan Gustavson (MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Curl of the noise field: divergence free, so points do not clump
vec2 curl(vec2 p, float t) {
  const float e = 0.01;
  float dx = snoise(vec2(p.x + e, p.y) + t) - snoise(vec2(p.x - e, p.y) + t);
  float dy = snoise(vec2(p.x, p.y + e) + t) - snoise(vec2(p.x, p.y - e) + t);
  return vec2(dy, -dx) / (2.0 * e);
}

void main() {
  vec2 pos = a_state.xy;
  vec2 vel = a_state.zw;

  vec2 acc = 4.0 * u_spring * (a_home * u_fit + u_center - pos);
  acc += 0.1 * u_flow * curl(pos * 1.5, u_time * 0.12);
  acc -= 2.0 * u_drag * vel;

  for (int i = 0; i < 5; i++) {
    if (i >= u_pointerCount) break;
    vec2 d = pos - u_pointers[i];
    float r = length(d);
    if (r < u_reach && r > 1e-5) {
      float k = 1.0 - r / u_reach;
      acc += u_pointerSign * 60.0 * k * k * d / r;
    }
  }

  if (u_scatter > 0.0) {
    vec2 d = pos - u_scatterCenter;
    float r = max(length(d), 1e-4);
    vel += (d / r) * u_scatter * (0.5 + a_seed);
  }

  vel += acc * u_dt;
  pos += vel * u_dt;

  // With no spring there is nothing to bring strays back: wrap off screen
  if (u_spring == 0.0) pos = mod(pos + u_bounds, 2.0 * u_bounds) - u_bounds;

  v_state = vec4(pos, vel);
  gl_Position = vec4(0.0);
}
