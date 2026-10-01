// Fluid: the display pass. Six passes ran
// before this one and left two textures: how
// much dye is in each cell, and which way the
// fluid there is moving. This pass turns them
// into a colour. Move the pointer to stir.
uniform sampler2D dye;
uniform sampler2D velocity;
uniform bool velocityPalette; // @toggle false

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float ink = 1.0 - exp(-texture(dye, uv).x);

  vec3 colour = vec3(0.82);
  if (velocityPalette) {
    // Hue from the direction of flow, fading in with speed
    vec2 v = texture(velocity, uv).xy;
    float angle = atan(v.y, v.x + 0.0001);
    vec3 hue = 0.62 + 0.38 * cos(angle + vec3(0.0, 2.094, 4.188));
    colour = mix(colour, hue, smoothstep(0.0, 60.0, length(v)));
  }
  fragColor = vec4(colour * ink, 1.0);
}
