// Constellation: the home page's field, drawn
// one pixel at a time. The plane is cut into
// cells, a diamond wanders inside each one, and
// a line joins two diamonds while they are
// close. Press to bend the field.
uniform float drift; // @slider 0 2 0.4
uniform float links; // @slider 0 1 0.25

const float ROWS = 12.0;

vec2 hash(vec2 cell) {
  vec3 p = fract(cell.xyx * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.xx + p.yz) * p.zy);
}

// Where the diamond that lives in this cell is now
vec2 home(vec2 cell) {
  vec2 seed = hash(cell);
  vec2 phase = iTime * drift * (0.5 + seed) + seed * 6.2831;
  return cell + 0.5 + 0.4 * sin(phase);
}

float diamond(vec2 p, vec2 at, float size, float px) {
  vec2 d = abs(p - at);
  return 1.0 - smoothstep(size - px, size + px, d.x + d.y);
}

// A thin line from a to b that fades as they move apart
float link(vec2 p, vec2 a, vec2 b, float px) {
  vec2 pa = p - a, ba = b - a;
  float along = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float gap = length(pa - ba * along);
  float near = 1.0 - smoothstep(0.5, 1.1, length(ba));
  return near * (1.0 - smoothstep(0.0, 1.5 * px, gap));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = ROWS / iResolution.y;
  vec2 p = fragCoord * px;
  vec2 away = p - iMouse.xy * px;
  if (iMouse.z > 0.0) {
    p -= 0.8 * away * exp(-0.5 * dot(away, away));
  }
  p.y -= iTime * drift;

  vec2 cell = floor(p);
  vec2 at[9];
  for (int i = 0; i < 9; i++) {
    at[i] = home(cell + vec2(i % 3, i / 3) - 1.0);
  }

  float lines = 0.0, diamonds = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i != 4) lines += link(p, at[4], at[i], px);
    vec2 id = cell + vec2(i % 3, i / 3) - 1.0;
    float size = mix(0.012, 0.055, hash(id + 0.5).x);
    diamonds += diamond(p, at[i], size, px);
  }
  lines += link(p, at[1], at[3], px) + link(p, at[1], at[5], px);
  lines += link(p, at[7], at[3], px) + link(p, at[7], at[5], px);

  float light = min(1.0, 0.6 * diamonds + links * lines);
  fragColor = vec4(vec3(light), 1.0);
}
