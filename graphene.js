"use strict";

function createShader(gl, type, source) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    return shader;
  let infoLog = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(infoLog);
}
function main() {

  let canvas = document.querySelector("canvas"),
    gl = canvas.getContext("webgl2"),
    $drawer = drawer(gl),
    projection = get_projection(40, canvas.width/canvas.height, .001, 10000),
    model = mat4.create(),
    trackball = new Trackball(canvas)
  ;

  (function animate() {
    let [W, H] = ['W', 'H'].map(l => parseInt(document.getElementById(l).value));
    $drawer(W, H, projection, trackball.matrix, model);
    requestAnimationFrame(animate);
  })();
}

function drawer(gl) {

  const glsl = {
    vertex: `#version 300 es

    precision mediump float;

    uniform int W;
    uniform int H;

    // A matrix to transform the positions by
    uniform mat4 PMatrix;
    uniform mat4 VMatrix;
    uniform mat4 MMatrix;

    const float third = -1.0+1.0/3.0;
    const float pi = 3.141592653589793;
    const float theta = pi/3.0;
    const float c = cos(theta);
    const float s = sin(theta);

    const vec2 a = vec2(1.0 + c, -s);
    const vec2 b = vec2(0.0, 2.0*s);

    out float intensity;

    void main() {
      int n = gl_VertexID / 12;
      int i = n % W;
      int j = n / W;
      float i_float = float(i - W / 2 );
      float j_float = float(j - H / 2 );

      vec2 xy;

      intensity = 1.0;

      //
      //   0              9
      //    \            /
      //     124 - 56 - 7810
      //    /            \
      //   3              11
      //
      switch(gl_VertexID % 12) {
        case 0: xy = vec2(third - c/2.0,     .5 + s/2.0); intensity = 0.0; break;
        case 1: xy = vec2(third        ,     .5        ); break;

        case 2: xy = vec2(third, .5)                    ; break;
        case 3: xy = vec2(third - c/2.0, .5 - s/2.0)    ; intensity = 0.0; break;

        case 4: xy = vec2(third, .5)                    ; break;
        case 5: xy = vec2(third+0.5, .5)                ; intensity = 0.0; break;

        case 6: xy = vec2(third+0.5, .5)                ; intensity = 0.0; break;
        case 7: xy = vec2(third+1.0, .5); break;

        case 8: xy = vec2(third+1.0, .5)                ; break;
        case 9: xy = vec2(third+1.0 + c/2.0, .5 + s/2.0); intensity = 0.0; break;

        case 10: xy = vec2(third+1.0, .5)                ; break;
        case 11: xy = vec2(third+1.0 + c/2.0, .5 - s/2.0); intensity = 0.0; break;
        default:
          ;
      }

      gl_Position = PMatrix * VMatrix * MMatrix *
      vec4(
        i_float*a + j_float*b +
          xy
        , 0.0, 1.0 );

    }`,
    fragment: `#version 300 es

    precision mediump float;

    in float intensity;
    out vec4 color;

    void main() {
      color = vec4(intensity, intensity, intensity, 1.0);
    }`
  };

  let canvas = gl.canvas,
    fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, glsl.fragment),
    vertexShader = createShader(gl, gl.VERTEX_SHADER, glsl.vertex),
    program = gl.createProgram();

  for (let shader of [ vertexShader, fragmentShader ])
    gl.attachShader(program, shader);

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    let err = new Error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    throw err;
  }

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);

  gl.useProgram(program);

  let uniformLocation = {}
  for (let name of ["W", "H", "PMatrix", "VMatrix", "MMatrix"]) {
    uniformLocation[name] = gl.getUniformLocation(program, name);
  }


  return function (W, H, projection, view, model) {
    let N = W*H;

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1i(uniformLocation['W'], W);
    gl.uniform1i(uniformLocation['H'], H);
    
    gl.uniformMatrix4fv(uniformLocation["PMatrix"], false, projection);
    gl.uniformMatrix4fv(uniformLocation["VMatrix"], false, view);
    gl.uniformMatrix4fv(uniformLocation["MMatrix"], false, model);

    gl.drawArrays(gl.LINES, 0, 12*N);
  }

}

function get_projection(angle, a, zMin, zMax) {
  let ang = Math.tan((angle*.5)*Math.PI/180);//angle*.5
  return mat4.fromValues(
    0.5/ang, 0 , 0, 0,
    0, 0.5*a/ang, 0, 0,
    0, 0, -(zMax+zMin)/(zMax-zMin), -1,
    0, 0, (-2*zMax*zMin)/(zMax-zMin), 0 
  );
}

