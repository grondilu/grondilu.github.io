#version 300 es

const float tau = 6.283185307179586;

uniform int N;
uniform float a;
uniform float e;
uniform float theta;

uniform mat4 PMatrix;
uniform mat4 VMatrix;
uniform mat4 MMatrix;

out float intensity;

void main() {

   intensity = float(gl_VertexID)/float(N);
   float p = a*(1.0-e*e);
   float phi = theta + tau*intensity;
   gl_Position = PMatrix*VMatrix*MMatrix*vec4( p*cos(phi), p*sin(phi), 0.0, 1.0 + e*cos(phi) );

}
