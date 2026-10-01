// Waves: ripples from three sources, added
// together. Where two crests meet the light
// doubles; where a crest meets a trough they
// cancel. Press and drag to move two of the
// sources. The third stays in the middle.
uniform float frequency; // @slider 4 40 16
uniform float speed; // @slider 0 4 1
uniform vec3 tint; // @color 0.82 0.82 0.82

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

  // The two moving sources mirror each other
  vec2 source = (2.0 * iMouse.xy - iResolution.xy) / iResolution.y;
  if (iMouse.xy == vec2(0.0)) {
    source = 0.6 * vec2(cos(iTime * 0.3), sin(iTime * 0.4));
  }

  float t = iTime * speed;
  float a = sin(length(uv - source) * frequency - t * 3.0);
  float b = sin(length(uv + source) * frequency * 0.8 - t * 2.0);
  float c = sin(length(uv) * frequency * 1.3 - t * 1.5);

  float height = (a + b + c) / 3.0;
  float light = smoothstep(-0.8, 1.0, height);
  fragColor = vec4(tint * light * light, 1.0);
}
