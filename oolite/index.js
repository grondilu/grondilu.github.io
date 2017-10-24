"use strict";

function openNav()  { document.getElementById("controls").style.width = "100%"; }
function closeNav() { document.getElementById("controls").style.width = "0%"; }

function defined(value) { return value !== undefined && value !== null; }
const pi = 355/113;
const model = "resources/models/oolite.gltf";
const clearColor = [0, 0, 0, 1];
const clearDepth = 10000;

const GLSL = {
    vertex: `uniform mat4 u_modelViewProjMatrix;
uniform mat4 u_normalMatrix;
uniform vec3 lightDir;

attribute vec3 vNormal;
attribute vec4 vTexCoord;
attribute vec4 vPosition;

varying float v_Dot;
varying vec2 v_texCoord;

void main()
{
    gl_Position = u_modelViewProjMatrix * vPosition;
    v_texCoord = vTexCoord.st;
    vec4 transNormal = u_normalMatrix * vec4(vNormal, 1);
    v_Dot = max(dot(transNormal.xyz, lightDir), 0.0);
}
    `,
    fragment: `precision mediump float;

uniform sampler2D sampler2d;
uniform float emissionFactor;

varying float v_Dot;
varying vec2  v_texCoord;

void main()
{
    vec4 color = texture2D(sampler2d, v_texCoord);
    gl_FragColor = vec4(emissionFactor*color.aaa + color.rgb * v_Dot, 1);
}`
}

function start() {
    let canvas  = document.getElementById("webgl-canvas"),
        gl      = canvas.getContext("webgl"),
        shaders = {
            vertex:   gl.createShader(gl.VERTEX_SHADER),
            fragment: gl.createShader(gl.FRAGMENT_SHADER)
        },
        program = gl.createProgram(),
        gltf    = fetch(model).then(resp => resp.json()),
        matrixStack = [
            mat4.create(),
            mat4.perspective(
                mat4.create(),
                pi/4,
                gl.canvas.clientWidth / gl.canvas.clientHeight,
                1, 10000
            ),
            mat4.lookAt(
                mat4.create(),
                [0, 0, 100],
                [0, 0, 0],
                [0, 1, 0]
            ),
            mat4.fromRotation(
                mat4.create(),
                pi/2,
                vec3.fromValues(1, 0, 0)
            ),
        ]
    ;

    // Compile shader program
    {
        gl.shaderSource(shaders.vertex, GLSL.vertex);
        gl.compileShader(shaders.vertex);

        gl.shaderSource(shaders.fragment, GLSL.fragment);
        gl.compileShader(shaders.fragment);

        gl.attachShader (program, shaders.vertex);
        gl.attachShader (program, shaders.fragment);

        gl.bindAttribLocation (program, 0, 'vNormal');
        gl.bindAttribLocation (program, 1, 'vTexCoord');
        gl.bindAttribLocation (program, 2, 'vPosition');

        gl.linkProgram(program);

        // Check the link status
        let linked = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!linked && !gl.isContextLost()) {
            // something went wrong with the link
            let error = gl.getProgramInfoLog (program);
            console.log("Error in program linking: ", error);
            gl.deleteProgram(program);
            gl.deleteProgram(fragmentShader);
            gl.deleteProgram(vertexShader);
            return null;
        }
        gl.useProgram(program);

        gl.clearColor(...clearColor);
        gl.clearDepth(clearDepth);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Set some uniform variables for the shaders
        gl.uniform3f(gl.getUniformLocation(program, "lightDir"), 0, 1, 0);
        gl.uniform1i(gl.getUniformLocation(program, "sampler2d"), 0);

        // Enable all of the vertex attribute arrays.
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);

    }

    gltf
        .then(json => loadBuffers(gl, json))
        .then(
            function (json) {
                let nodes   = json.nodes
                    .filter(x => x.name.startsWith("Cobra")),
                    primitives = [];
                for (let node of nodes) {
                    let mesh     = json.meshes[node.mesh];
                    for (let primitive of mesh.primitives) {
                        primitives.push(primitive);
                        let attributes = primitive.attributes,
                            vertices   = getAccessorData(json, attributes.POSITION),
                            normals    = getAccessorData(json, attributes.NORMAL),
                            texCoords  = getAccessorData(json, attributes.TEXCOORD_0);

                        primitive.normalObject = gl.createBuffer();
                        gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalObject);
                        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

                        primitive.texCoordObject = gl.createBuffer();
                        gl.bindBuffer(gl.ARRAY_BUFFER, primitive.texCoordObject);
                        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

                        primitive.vertexObject = gl.createBuffer();
                        gl.bindBuffer(gl.ARRAY_BUFFER, primitive.vertexObject);
                        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

                        if (defined(primitive.indices)) {
                            let indices   = getAccessorData(json, primitive.indices);
                            gl.bindBuffer(gl.ARRAY_BUFFER, null);

                            primitive.indexObject = gl.createBuffer();
                            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexObject);
                            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
                            //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                            //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.box.indexObject);

                            primitive.numIndices = indices.length;
                        }

                        primitive.image   = new Image();
                        primitive.texture = gl.createTexture();
                        primitive.image.onload = function () {
                            gl.bindTexture(gl.TEXTURE_2D, primitive.texture);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, primitive.image);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                            gl.generateMipmap(gl.TEXTURE_2D)
                            gl.bindTexture(gl.TEXTURE_2D, null);
                        }
                        primitive.image.crossOrigin = "anonymous";
                        primitive.image.src =
                            "https://raw.githubusercontent.com/OoliteProject/oolite-binary-resources/master/Textures/" +
                            json.images[
                                json.materials[primitive.material]
                                .pbrMetallicRoughness
                                .baseColorTexture
                                .index
                            ].uri
                        ;
                        primitive.emissiveFactor = primitive.image.src
                            .includes("_diffuse") ?
                            2.0 : 0.0

                    }
                }
                return primitives;
            }
        )
        .then(
            function (primitives) {
                let mvMatrix = matrixStack
                    .reduce((a, b) => mat4.multiply(mat4.create(), a, b)),
                    rotation = mat4.create(),
                    normalMatrix = mat4.create();

                function drawPrimitives(angle) {
                    gl.uniformMatrix4fv(
                        gl.getUniformLocation(program, "u_modelViewProjMatrix"),
                        false, 
                        mat4.multiply(
                            mat4.create(),
                            mvMatrix,
                            mat4.rotate(
                                mat4.create(),
                                mat4.rotate(
                                    mat4.create(),
                                    mat4.rotate(mat4.create(), rotation, angle, [0, 0, 1]),
                                    0.2*angle, [0, 1, 0]
                                ),
                                0.1*angle, [1, 0, 0]
                            )
                        )
                    );
                    gl.uniformMatrix4fv(
                        gl.getUniformLocation(program, "u_normalMatrix"),
                        false,
                        mat4.rotate(
                            mat4.create(),
                            mat4.rotate(
                                mat4.create(),
                                mat4.rotate(mat4.create(), rotation, angle, [0, 0, 1]),
                                0.2*angle, [0, 1, 0]
                            ),
                            0.1*angle, [1, 0, 0]
                        )
                    );

                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    for (let primitive of primitives) {
                        gl.uniform1f(
                            gl.getUniformLocation(program, "emissionFactor"),
                            primitive.emissiveFactor
                        );
                        // Set up all the vertex attributes for vertices, normals and texCoords
                        gl.bindBuffer(gl.ARRAY_BUFFER, primitive.vertexObject);
                        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

                        gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalObject);
                        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

                        gl.bindBuffer(gl.ARRAY_BUFFER, primitive.texCoordObject);
                        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexObject);
                        gl.bindTexture(gl.TEXTURE_2D, primitive.texture);

                        gl.drawElements(
                            gl.TRIANGLES, primitive.numIndices,
                            gl.UNSIGNED_SHORT, 0
                        );
                    }
                }

                let angle = 0,
                    time  = Date.now();
                function animate() {
                    let now = Date.now();
                    drawPrimitives(angle);
                    angle += 0.0004*(now - time);
                    time = now;
                    window.requestAnimationFrame(animate);
                }

                animate();
            }
        );

}

function loadBuffers(gl, gltf) {
    let promises = [];
    for (let buffer of gltf.buffers) {
        if (buffer.reader === undefined) {
            buffer.reader = new FileReader();
            fetch("resources/models/" + buffer.uri)
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
    return Promise.all(promises)
        .then(() => gltf);
}

function getAccessorData(gltf, accessorIndex) {
    let accessor     = gltf.accessors[accessorIndex],
        bufferView   = gltf.bufferViews[accessor.bufferView],
        buffer       = gltf.buffers[bufferView.buffer],
        result       = buffer.reader.result,
        start        = defined(bufferView.byteOffset) ? bufferView.byteOffset : 0,
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
                        console.log("unknown component type");
                        return Number;
                }
            }(accessor.componentType)
        )(slicedBuffer);

    return data;
}
