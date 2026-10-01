// Ink: layered noise dragged along a made-up
// flow that whirls around the pointer. Nothing is
// kept from one frame to the next, so this is a
// drawing of a liquid and not a simulation of
// one. Press and drag to move the whirl.
uniform float flow; // @slider 0 3 1
uniform float swirl; // @slider 0 2 0.8
uniform float density; // @slider 0.2 2 1.2

float hash(vec2 p) {
  float h = dot(p, vec2(12.9898, 78.233));
  return fract(sin(h) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float low = mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x);
  float high = mix(
    hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x);
  return mix(low, high, f.y);
}

// Four octaves, each twice as fine and half as strong
float layers(vec2 p) {
  float value = 0.0, strength = 0.5;
  for (int i = 0; i < 4; i++) {
    value += strength * noise(p);
    p *= 2.0;
    strength *= 0.5;
  }
  return value;
}

// The made-up flow: a whirl that is fastest near the
// pointer, plus turbulence
vec2 velocityAt(vec2 p, vec2 pointer) {
  vec2 away = p - pointer;
  vec2 whirl = vec2(-away.y, away.x);
  whirl /= 3.0 * dot(away, away) + 0.1;
  float angle = layers(p * 3.0 + iTime * 0.1 * flow);
  angle *= 12.566;
  return swirl * whirl + 0.5 * vec2(cos(angle), sin(angle));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  vec2 pointer = iMouse.xy / iResolution.y;
  if (iMouse.xy == vec2(0.0)) {
    pointer = 0.5 * iResolution.xy / iResolution.y;
    pointer += 0.2 * vec2(cos(iTime * 0.2), sin(iTime * 0.3));
  }

  // Look upstream, in three short steps, for the ink
  // that has arrived here
  vec2 from = p;
  for (int i = 0; i < 3; i++) {
    from -= 0.05 * velocityAt(from, pointer);
  }
  float ink = layers(from * 4.0 + iTime * 0.15 * flow);
  ink = density * smoothstep(0.4, 0.85, ink);

  // Bone where the flow is slow, colour where it is fast
  vec2 velocity = velocityAt(p, pointer);
  float pace = clamp(0.5 * length(velocity) - 0.2, 0.0, 1.0);
  float phase = atan(velocity.y, velocity.x) + iTime * 0.5;
  vec3 sheen = 0.5 + 0.5 * sin(phase + vec3(0.0, 2.094, 4.188));
  vec3 colour = ink * mix(vec3(0.82), sheen, pace);

  colour = colour / (colour + 0.9);
  fragColor = vec4(pow(colour, vec3(0.4545)), 1.0);
}
