#version 300 es
precision highp float;

// One fragment shader for all four families. The same program draws the Julia
// inset: the caller sets a second viewport and passes its corner as u_origin.

uniform vec2 u_origin;      // lower-left corner of the viewport, in pixels
uniform vec2 u_resolution;  // size of the viewport, in pixels
uniform vec2 u_center;      // the complex number at the middle of the viewport
uniform float u_scale;      // complex units per pixel, the same on both axes
uniform int u_family;       // 0 Mandelbrot, 1 Julia, 2 Burning Ship, 3 Newton
uniform int u_iterations;
uniform int u_smooth;
uniform vec2 u_julia;
uniform float u_relaxation;
uniform vec3 u_palette[11];
uniform int u_paletteSize;

out vec4 outColor;

const float BAILOUT = 256.0;

vec3 palette(float t) {
  float x = clamp(t, 0.0, 1.0) * float(u_paletteSize - 1);
  int i = int(floor(x));
  int j = min(i + 1, u_paletteSize - 1);
  return mix(u_palette[i], u_palette[j], x - float(i));
}

// Newton's method on z^3 - 1. Each root takes a third of the palette, and a
// point darkens with the number of steps it needed to reach its root.
vec3 newton(vec2 z) {
  for (int n = 0; n < u_iterations; n++) {
    vec2 z2 = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
    vec2 f = vec2(z2.x * z.x - z2.y * z.y - 1.0, z2.x * z.y + z2.y * z.x);
    vec2 d = 3.0 * z2;
    float m = dot(d, d);
    if (m < 1e-12) break;
    z -= u_relaxation * vec2(f.x * d.x + f.y * d.y, f.y * d.x - f.x * d.y) / m;
    for (int root = 0; root < 3; root++) {
      float angle = 2.0943951 * float(root);
      if (distance(z, vec2(cos(angle), sin(angle))) < 0.001) {
        return palette(float(root + 1) / 3.0) * exp(-0.09 * float(n));
      }
    }
  }
  return vec3(0.0);
}

void main() {
  vec2 p = u_center + (gl_FragCoord.xy - u_origin - 0.5 * u_resolution) * u_scale;
  if (u_family == 3) {
    outColor = vec4(newton(p), 1.0);
    return;
  }

  vec2 z = u_family == 1 ? p : vec2(0.0);
  vec2 c = u_family == 1 ? u_julia : p;
  // The Burning Ship is drawn hull down, the way it is usually shown
  if (u_family == 2) c.y = -c.y;

  int n = 0;
  for (; n < u_iterations; n++) {
    if (dot(z, z) > BAILOUT) break;
    if (u_family == 2) z = abs(z);
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
  }

  // Points that never escape are in the set
  if (n >= u_iterations) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float count = float(n);
  // Fractional escape count, which removes the bands between whole steps
  if (u_smooth == 1) count += 1.0 - log2(0.5 * log2(dot(z, z)));
  // The first few steps are spent far from the set, so the shading eases in
  float x = max(count, 0.0);
  outColor = vec4(palette(sqrt(x / float(u_iterations)) * x / (x + 4.0)), 1.0);
}
