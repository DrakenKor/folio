// Mandelbulb: a fractal found by marching rays
// against an estimate of the distance to its
// surface. Its power swings over time, so the
// shape never settles. Drag to orbit.
uniform float power; // @slider 4 12 8
uniform bool spin; // @toggle true

// x: distance to the surface. y: how near the
// orbit came to the origin, which marks creases.
vec2 mandelbulb(vec3 pos) {
  vec3 z = pos;
  float dr = 1.0, r = 0.0, trap = 4.0;
  float n = power + 2.0 * sin(iTime * 0.5);
  for (int i = 0; i < 10; i++) {
    r = length(z);
    if (r > 2.0) break;
    trap = min(trap, r);
    float theta = acos(z.z / r) * n;
    float phi = atan(z.y, z.x) * n;
    dr = pow(r, n - 1.0) * n * dr + 1.0;
    z = pos + pow(r, n) * vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta));
  }
  return vec2(0.5 * log(r) * r / dr, trap);
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0005;
  return normalize(
    e.xyy * mandelbulb(p + e.xyy).x +
    e.yyx * mandelbulb(p + e.yyx).x +
    e.yxy * mandelbulb(p + e.yxy).x +
    e.xxx * mandelbulb(p + e.xxx).x);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float view = min(iResolution.x, iResolution.y);
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / view;

  // A press sets the camera's angles from the pointer
  vec2 m = iMouse.xy / iResolution.xy;
  if (iMouse.xy == vec2(0.0)) m = vec2(0.5, 0.62);
  float yaw = (m.x - 0.5) * 6.2831;
  float pitch = (m.y - 0.5) * 3.0;
  if (spin) yaw += iTime * 0.2;
  vec3 eye = 3.0 * vec3(
    cos(pitch) * sin(yaw),
    sin(pitch),
    cos(pitch) * cos(yaw));
  vec3 forward = normalize(-eye);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 ray = normalize(
    1.6 * forward + uv.x * right + uv.y * up);

  // Only rays that enter the sphere around it march
  vec3 colour = vec3(0.0);
  float b = dot(eye, ray);
  float h = b * b - dot(eye, eye) + 1.5;
  if (h > 0.0) {
    float t = -b - sqrt(h), far = -b + sqrt(h);
    vec2 d = vec2(1.0);
    for (int i = 0; i < 96 && t < far; i++) {
      d = mandelbulb(eye + ray * t);
      if (d.x < 0.0008 * t) break;
      t += d.x * 0.8;
    }
    if (d.x < 0.0008 * t) {
      vec3 p = eye + ray * t;
      vec3 normal = normalAt(p);
      vec3 sun = normalize(vec3(sin(iTime), 1.0, cos(iTime)));
      float lit = max(dot(normal, sun), 0.0);
      float shine = max(dot(reflect(sun, normal), ray), 0.0);
      // Copper in the creases, bone on the crests
      float crest = smoothstep(0.7, 1.15, d.y);
      vec3 base = mix(
        vec3(0.55, 0.22, 0.08), vec3(0.82, 0.8, 0.76), crest);
      colour = base * (lit + 0.08) * (0.25 + 0.75 * crest);
      colour += 0.3 * pow(shine, 32.0);
    }
  }
  fragColor = vec4(pow(colour, vec3(0.4545)), 1.0);
}
