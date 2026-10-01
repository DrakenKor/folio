// Hello sphere: the smallest raymarcher. Step
// along a ray until the distance to the sphere
// is nearly nothing, then light the point that
// was hit. Press to hold the light.
uniform vec3 tint; // @color 0.82 0.82 0.82

float map(vec3 p) {
  return length(p) - 1.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 view = min(iResolution.xx, iResolution.yy);
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / view;
  vec3 eye = vec3(0.0, 0.0, 3.0);
  vec3 ray = normalize(vec3(uv, -1.5));

  float t = 0.0;
  for (int i = 0; i < 48; i++) {
    float d = map(eye + ray * t);
    if (d < 0.001 || t > 10.0) break;
    t += d;
  }

  vec3 colour = vec3(0.0);
  if (t < 10.0) {
    vec3 normal = normalize(eye + ray * t);
    vec3 light = vec3(cos(iTime), 0.6, sin(iTime));
    if (iMouse.z > 0.0) {
      light = vec3(2.0 * iMouse.xy - iResolution.xy, view.x);
    }
    float lit = max(dot(normal, normalize(light)), 0.0);
    colour = tint * (lit + 0.03);
  }
  fragColor = vec4(pow(colour, vec3(0.4545)), 1.0);
}
