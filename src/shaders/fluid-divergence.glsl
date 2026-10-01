#version 300 es
precision highp float;
precision highp sampler2D;

// Divergence: how much more flows out of a cell than into it. A fluid that
// cannot be squeezed has none, so this is the error the next two passes remove.
uniform sampler2D uVelocity;
uniform vec2 uTexel;

in vec2 vUv;
out vec4 result;

void main() {
  vec2 x = vec2(uTexel.x, 0.0), y = vec2(0.0, uTexel.y);
  float left = texture(uVelocity, vUv - x).x;
  float right = texture(uVelocity, vUv + x).x;
  float down = texture(uVelocity, vUv - y).y;
  float up = texture(uVelocity, vUv + y).y;
  // Walls: past an edge the neighbour mirrors this cell, so nothing crosses
  vec2 here = texture(uVelocity, vUv).xy;
  if (vUv.x - uTexel.x < 0.0) left = -here.x;
  if (vUv.x + uTexel.x > 1.0) right = -here.x;
  if (vUv.y - uTexel.y < 0.0) down = -here.y;
  if (vUv.y + uTexel.y > 1.0) up = -here.y;
  result = vec4(0.5 * (right - left + up - down), 0.0, 0.0, 1.0);
}
