// City: boxes and cylinders, each described by
// its distance function, joined by keeping the
// nearest. The buildings rise and fall slowly.
// Drag to orbit.
uniform float rise; // @slider 0.3 2 1
uniform float haze; // @slider 0 1 0.5

float box(vec3 p, vec3 size) {
  vec3 q = abs(p) - size;
  float inside = min(max(q.x, max(q.y, q.z)), 0.0);
  return length(max(q, 0.0)) + inside;
}

float cylinder(vec3 p, float height, float radius) {
  vec2 d = abs(vec2(length(p.xz), p.y));
  d -= vec2(radius, height);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Distance to the nearest building. The ground is
// at y = -1 and every building stands on it.
float map(vec3 p) {
  float nearest = 100.0;
  for (int i = 0; i < 8; i++) {
    float f = float(i);
    float height = 2.0 + 1.5 * sin(f + iTime * 0.1);
    height *= rise;
    vec3 at = 5.0 * vec3(sin(f * 2.3), 0.0, cos(f * 1.7));
    at.y = height - 1.0;
    vec3 size = vec3(0.5 + 0.3 * sin(f), height,
      0.5 + 0.3 * cos(f));
    nearest = min(nearest, box(p - at, size));
  }
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    float turn = iTime * 0.05;
    float height = 4.0 + 2.0 * sin(f * 2.0 + iTime * 0.2);
    height *= rise;
    vec3 at = 8.0 * vec3(
      sin(f * 3.1 + turn), 0.0, cos(f * 2.7 + turn));
    at.y = height - 1.0;
    nearest = min(nearest, cylinder(p - at, height, 0.3));
  }
  return nearest;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.001;
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// How much of the sun reaches p: march towards it
// and note how closely the ray grazes a building
float shadow(vec3 p, vec3 sun) {
  float open = 1.0, t = 0.05;
  for (int i = 0; i < 24 && t < 24.0; i++) {
    float d = map(p + sun * t);
    open = min(open, 8.0 * d / t);
    t += clamp(d, 0.05, 2.0);
  }
  return clamp(open, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

  vec2 m = iMouse.xy / iResolution.xy;
  if (iMouse.xy == vec2(0.0)) m = vec2(0.62, 0.22);
  float yaw = (m.x - 0.5) * 6.2831 + iTime * 0.05;
  float pitch = 0.1 + 1.2 * m.y;
  vec3 target = vec3(0.0, 3.0, 0.0);
  vec3 eye = target + 20.0 * vec3(
    cos(pitch) * sin(yaw),
    sin(pitch),
    cos(pitch) * cos(yaw));
  vec3 forward = normalize(target - eye);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 ray = normalize(
    1.7 * forward + uv.x * right + uv.y * up);

  // The ground is flat, so the ray meets it at a
  // distance that needs no marching
  float far = 80.0;
  if (ray.y < 0.0) far = min(far, -(eye.y + 1.0) / ray.y);
  float t = 0.0;
  bool built = false;
  for (int i = 0; i < 80 && t < far; i++) {
    float d = map(eye + ray * t);
    if (d < 0.001 * t) {
      built = true;
      break;
    }
    t += d;
  }
  t = min(t, far);

  // Night, with a little light left along the horizon
  float horizon = pow(1.0 - abs(ray.y), 8.0);
  vec3 sky = vec3(0.004, 0.005, 0.008) + 0.04 * horizon;
  vec3 colour = sky;
  if (t < 80.0) {
    vec3 p = eye + ray * t;
    vec3 normal = built ? normalAt(p) : vec3(0.0, 1.0, 0.0);
    float turn = 2.2 + iTime * 0.1;
    vec3 sun = normalize(vec3(sin(turn), 0.45, cos(turn)));
    float lit = max(dot(normal, sun), 0.0);
    lit *= shadow(p + 0.02 * normal, sun);
    vec3 stone = built ? vec3(0.82, 0.8, 0.76) : vec3(0.16);
    colour = stone * (lit + 0.05 + 0.03 * normal.y);
    float fog = 1.0 - exp(-haze * haze * 0.004 * t * t);
    colour = mix(colour, sky, fog);
  }
  fragColor = vec4(pow(colour, vec3(0.4545)), 1.0);
}
