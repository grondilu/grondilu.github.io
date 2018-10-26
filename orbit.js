"use strict";

function get_projection(angle, a, zMin, zMax) {
  let ang = Math.tan((angle*.5)*Math.PI/180);//angle*.5
  return mat4.fromValues(
    0.5/ang, 0 , 0, 0,
    0, 0.5*a/ang, 0, 0,
    0, 0, -(zMax+zMin)/(zMax-zMin), -1,
    0, 0, (-2*zMax*zMin)/(zMax-zMin), 0 
  );
}

function createShader(gl, type, source) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  let err = new Error(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  throw err;
}

function solveKepler(e, M, N = 20) {
  let E = M;
  for(let i = 0; i<N; i++) E = M + e*Math.sin(E);
  return E;
}

function drawScene(gl, ...drawers) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  for (let drawer of drawers) drawer();
}

function conicDrawer(gl) {
  const vertexShaderSource = `#version 300 es

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

}`;
  const fragmentShaderSource = `#version 300 es
 
// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision"
precision mediump float;
 
// we need to declare an output for the fragment shader
out vec4 outColor;

in float intensity;
 
void main() {
  outColor = vec4(intensity, intensity, intensity, 1);
}`;

  let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource),
    fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource),
    program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    let err = new Error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    throw err;
  }

  let uniformLocation = {}
  for (let name of ["N", "a", "e", "theta", "PMatrix", "VMatrix", "MMatrix",]) {
    uniformLocation[name] = gl.getUniformLocation(program, name);
  }

  const N = 256;

  return function(matrices, eccentricity, semiMajorAxis, theta = 0) {
    gl.useProgram(program);
    gl.uniform1i(uniformLocation["N"], N);
    gl.uniform1f(uniformLocation["a"], semiMajorAxis);
    gl.uniform1f(uniformLocation["e"], eccentricity);
    gl.uniform1f(uniformLocation["theta"], theta);
    gl.uniformMatrix4fv(uniformLocation["PMatrix"], false, matrices.proj);
    gl.uniformMatrix4fv(uniformLocation["VMatrix"], false, gl.trackball.matrix);
    gl.uniformMatrix4fv(uniformLocation["MMatrix"], false, matrices.model);

    gl.drawArrays(gl.LINE_STRIP, 0, N);
  }

}

async function loadBuffers(gltf) {
    let promises = [];
    for (let buffer of gltf.buffers) {
        if (buffer.reader === undefined) {
            buffer.reader = new FileReader();
            fetch(buffer.uri, {cache: "no-store"})
                .then(response => response.blob())
                .then(blob => buffer.reader.readAsArrayBuffer(blob));
            promises.push(
                new Promise(
                    (resolve, reject) =>
                    buffer.reader.onload = resolve
                )
            );
        }
    }
    return Promise.all(promises);
}

function getAccessorData(gltf, accessor) {
  let bufferView   = gltf.bufferViews[accessor.bufferView],
    buffer       = gltf.buffers[bufferView.buffer],
    result       = buffer.reader.result,
    start        = bufferView.byteOffset ? bufferView.byteOffset : 0,
    end          = start + bufferView.byteLength,
    slicedBuffer = result.slice(start, end),
    data         = new (
      function (componentType) {
        switch (componentType) {
          case 5120:
            return Int8Array;
          case 5121:
            return Uint8Array;
          case 5122:
            return Int16Array;
          case 5123:
            return Uint16Array;
          case 5125:
            return Uint32Array;
          case 5126:
            return Float32Array;
          default:
            throw new Error("unknown component type " + componentType);
        }
      }(accessor.componentType)
  )(slicedBuffer);
  return data;
}

async function asteroidDrawer(gl, matrices) {

  let drawers = [];
  const vertexShaderSource = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec3 a_normal;

// A matrix to transform the positions by
uniform mat4 PMatrix;
uniform mat4 VMatrix;
uniform mat4 MMatrix;


// varying to pass the normal to the fragment shader
out vec3 v_normal;

// all shaders have a main function
void main() {
  // Multiply the position by the matrix.
  gl_Position = PMatrix * VMatrix * MMatrix * a_position;

  // Pass the normal to the fragment shader
  v_normal = a_normal;
}`;
  const fragmentShaderSource = `#version 300 es

precision mediump float;

// Passed in and varied from the vertex shader.
in vec3 v_normal;

uniform vec3 u_reverseLightDirection;
uniform vec4 u_color;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  // because v_normal is a varying it's interpolated
  // so it will not be a uint vector. Normalizing it
  // will make it a unit vector again
  vec3 normal = normalize(v_normal);

  // compute the light by taking the dot product
  // of the normal to the light's reverse direction
  float light = dot(normal, u_reverseLightDirection);

  outColor = u_color;

  // Lets multiply just the color portion (not the alpha)
  // by the light
  outColor.rgb *= light;
}`;

  let vertexShader = gl.createShader(gl.VERTEX_SHADER),
    fragmentShader = gl.createShader(gl.FRAGMENT_SHADER),
    program = gl.createProgram();
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(vertexShader));
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(fragmentShader));
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));

  let positionAttributeLocation = gl.getAttribLocation(program, "a_position"),
    normalAttributeLocation = gl.getAttribLocation(program, "a_normal"),
    pMatrixLocation = gl.getUniformLocation(program, "PMatrix"),
    vMatrixLocation = gl.getUniformLocation(program, "VMatrix"),
    mMatrixLocation = gl.getUniformLocation(program, "MMatrix"),
    colorLocation = gl.getUniformLocation(program, "u_color"),
    reverseLightDirectionLocation = gl.getUniformLocation(program, "u_reverseLightDirection");

  console.log("fetching asteroid.gltf");
  let gltf = await fetch("asteroid.gltf", {cache: "no-store"}).then(r => r.json());
  console.log("fetching binary data");
  await loadBuffers(gltf);

  for (let node of gltf.nodes) {
    let mesh     = gltf.meshes[node.mesh];
    for (let primitive of mesh.primitives) {
      let attributes = primitive.attributes,
        vertices   = getAccessorData(gltf, gltf.accessors[attributes.POSITION]),
        normals    = getAccessorData(gltf, gltf.accessors[attributes.NORMAL]);

      if (primitive.indices !== undefined) {
        let accessor = gltf.accessors[primitive.indices],
          indices = getAccessorData(gltf, accessor),
          indexType = accessor.componentType;

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        primitive.indexObject = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexObject);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.box.indexObject);

        primitive.numIndices = indices.length;
        primitive.indexType  = 
          indexType == 5121 ? gl.UNSIGNED_BYTE :
          indexType == 5123 ? gl.UNSIGNED_SHORT :
          indexType == 5125 ? gl.UNSIGNED_INT :
          null;
      }

      let positionBuffer = gl.createBuffer(),
        vao = gl.createVertexArray();

      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(positionAttributeLocation);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

      let normalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(normalAttributeLocation);

      gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);

      drawers.push(
        function() {
          gl.useProgram(program);

          gl.bindVertexArray(vao);

          gl.uniformMatrix4fv(pMatrixLocation, false, matrices.proj);
          gl.uniformMatrix4fv(vMatrixLocation, false, gl.trackball.matrix);
          gl.uniformMatrix4fv(mMatrixLocation, false, matrices.model);
          gl.uniform4fv(colorLocation, [1.0, 1.0, 1.0, 1.0]);

          gl.uniform3fv(reverseLightDirectionLocation, [1.0, 0.0, 0.0]);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexObject);
          gl.drawElements(
            gl.TRIANGLES, primitive.numIndices,
            primitive.indexType, 0
          );
        }
      );
    }
  }

  return drawers;

}

async function main() {
  let canvas = document.getElementById("asteroid"),
    gl = canvas.getContext("webgl2"),
    conic = conicDrawer(gl, 0.2);

  gl.trackball = new Trackball(canvas),
  canvas.width = 800;
  canvas.height = 640;

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);

  let matrices = {
    proj: get_projection(40, gl.canvas.width/gl.canvas.height, 1, 100),
    model: mat4.create(),
    view: gl.trackball.matrix,
  }, 
  asteroids = await asteroidDrawer(gl, matrices),
    orbitalElements = {
    eccentricity: 0.8,
    semiMajorAxis: 6,
  };

  (function animate() {
    let e = orbitalElements.eccentricity,
      a = orbitalElements.semiMajorAxis,
      w = 0.3,
      t = Date.now()/1000,
      M = (w*t) % (2*Math.PI) - Math.PI,
      E = solveKepler(e, M),
      theta = 2*Math.atan(Math.sqrt((1+e)/(1-e))*Math.tan(E/2));

    drawScene(
      gl,
      () => conic(matrices, e, a, theta),
        ...asteroids
    );
      window.requestAnimationFrame(animate);
  })();

}

