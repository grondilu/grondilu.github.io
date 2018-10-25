#version 300 es
 
// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision"
precision mediump float;
 
// we need to declare an output for the fragment shader
out vec4 outColor;

in float intensity;
 
void main() {
  outColor = vec4(intensity, intensity, intensity, 1);
}
