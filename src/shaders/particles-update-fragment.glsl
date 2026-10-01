#version 300 es
// Never runs (the rasteriser is discarded) but a program needs a fragment stage.
precision lowp float;
out vec4 color;
void main() {
  color = vec4(0.0);
}
