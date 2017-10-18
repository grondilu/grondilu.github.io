"use strict";
function defined(value) { return value !== undefined && value !== null; }

let g            = { cobra3: [] },
    currentAngle = 0,
    cobra3Texture,
    requestId,
    time = Date.now();

const incAngle = .02;
const model = "./resources/models/cobra3.gltf";

function init() {
    // Initialize
    let gl = initWebGL("example"); if (!gl) { return; }
    let program = simpleSetup(
        gl,
        // The ids of the vertex and fragment shaders
        "vshader", "fshader",
        // The vertex attribute names used by the shaders.
        // The order they appear here corresponds to their index
        // used later.
        [ "vNormal", "vColor", "vPosition"],
        // The clear color and depth values
        [ .1, 0, 0, 1 ], 10000
    );

    // Set some uniform variables for the shaders
    gl.uniform3f(gl.getUniformLocation(program, "lightDir"), 0, 0, 1);
    gl.uniform1i(gl.getUniformLocation(program, "sampler2d"), 0);

    // Create a box. On return 'g' contains a 'box' property with
    // the BufferObjects containing the arrays for vertices,
    // normals, texture coords, and indices.
    g.box = makeBox(gl);

    // Load an image to use. Returns a WebGLTexture object
    //cobra3Texture = loadImageTexture(gl, "resources/textures/cobra3/diffuse.png");

    // Create some matrices to use later and save their locations in the
    // shaders
    g.mvMatrix = new J3DIMatrix4();
    g.u_normalMatrixLoc = gl.getUniformLocation(program, "u_normalMatrix");
    g.normalMatrix = new J3DIMatrix4();
    g.u_modelViewProjMatrixLoc =
        gl.getUniformLocation(program, "u_modelViewProjMatrix");
    g.mvpMatrix = new J3DIMatrix4();

    // Enable all of the vertex attribute arrays.
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);

    // Set up all the vertex attributes for vertices, normals and texCoords
    gl.bindBuffer(gl.ARRAY_BUFFER, g.box.vertexObject);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, g.box.normalObject);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, g.box.texCoordObject);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    // Bind the index array
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.box.indexObject);

    return gl;
}
function reshape(gl) {
    // change the size of the canvas's backing store to match the size it is
    // displayed.
    if (
        gl.canvas.clientWidth  == gl.canvas.width  &&
        gl.canvas.clientHeight == gl.canvas.height
    ) return;

    gl.canvas.width  = gl.canvas.clientWidth;
    gl.canvas.height = gl.canvas.clientHeight;

    // Set the viewport and projection matrix for the scene
    gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);
    g.perspectiveMatrix = new J3DIMatrix4();
    g.perspectiveMatrix.perspective(30, gl.canvas.clientWidth / gl.canvas.clientHeight, 1, 10000);
    g.perspectiveMatrix.lookat(0, 0, 200, 0, 0, 0, 0, 1, 0);
}

function drawPicture(gl) {
    // Make sure the canvas is sized correctly.
    reshape(gl);

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Make a model/view matrix.
    g.mvMatrix.makeIdentity();
    g.mvMatrix.rotate(20, 1,0,0);
    g.mvMatrix.rotate(currentAngle, 0,1,0);

    // Construct the normal matrix from the model-view matrix and pass it in
    g.normalMatrix.load(g.mvMatrix);
    g.normalMatrix.invert();
    g.normalMatrix.transpose();
    g.normalMatrix.setUniform(gl, g.u_normalMatrixLoc, false);

    // Construct the model-view * projection matrix and pass it in
    g.mvpMatrix.load(g.perspectiveMatrix);
    g.mvpMatrix.multiply(g.mvMatrix);
    g.mvpMatrix.setUniform(gl, g.u_modelViewProjMatrixLoc, false);

    // Bind the texture to use
    gl.bindTexture(gl.TEXTURE_2D, cobra3Texture);

    // Draw the cube
    gl.drawElements(gl.TRIANGLES, g.box.numIndices, gl.UNSIGNED_SHORT, 0);

    // Show the framerate
    framerate.snapshot();

    let now = Date.now();
    currentAngle += incAngle*(now - time);
    time = now;
    if (currentAngle > 360) currentAngle -= 360;
}

function start() {
    let c = document.getElementById("example");

    //c = WebGLDebugUtils.makeLostContextSimulatingCanvas(c);
    // tell the simulator when to lose context.
    //c.loseContextInNCalls(1);

    /*
    c.addEventListener('webglcontextlost',
        e => {
            e.preventDefault();
            clearLoadingImages();
            if (requestId !== undefined) {
                window.cancelAnimFrame(requestId);
                requestId = undefined;
            }
        }, false
    );
    c.addEventListener('webglcontextrestored',
        () => {
            init();
            f();
        }, false
    );

    let gl = init();
    if (!gl) { return; }
    */

    // Initialize
    let gl = initWebGL("example"); if (!gl) { return; }
    let program = simpleSetup(
        gl,
        // The ids of the vertex and fragment shaders
        "vshader", "fshader",
        // The vertex attribute names used by the shaders.
        // The order they appear here corresponds to their index
        // used later.
        [ "vNormal", "vColor", "vPosition"],
        // The clear color and depth values
        [ .1, 0, 0, 1 ], 10000
    );

    // Set some uniform variables for the shaders
    gl.uniform3f(gl.getUniformLocation(program, "lightDir"), 0, 0, 1);
    gl.uniform1i(gl.getUniformLocation(program, "sampler2d"), 0);

    // Load an image to use. Returns a WebGLTexture object
    cobra3Texture = loadImageTexture(gl, "resources/textures/cobra3/diffuse.png");

    // Create some matrices to use later and save their locations in the
    // shaders
    g.mvMatrix = new J3DIMatrix4();
    g.u_normalMatrixLoc = gl.getUniformLocation(program, "u_normalMatrix");
    g.normalMatrix = new J3DIMatrix4();
    g.u_modelViewProjMatrixLoc =
        gl.getUniformLocation(program, "u_modelViewProjMatrix");
    g.mvpMatrix = new J3DIMatrix4();

    // Enable all of the vertex attribute arrays.
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);

    loadModel(gl, model)
        .then(
            gltf => {
                g.box = gltf.meshes[1].primitives[0];

                // Set up all the vertex attributes for vertices, normals and texCoords
                gl.bindBuffer(gl.ARRAY_BUFFER, g.box.vertexObject);
                gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, g.box.normalObject);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, g.box.texCoordObject);
                gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

                // Bind the index array
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.box.indexObject);

                function f() {
                    drawPicture(gl);
                    requestId = window.requestAnimFrame(f, c);
                }
                f();

            }
        );

    currentAngle = 0;
    framerate = new Framerate("framerate");

    function f() {
        drawPicture(gl);
        requestId = window.requestAnimFrame(f, c);
    }

}


function loadModel(gl, url) {
    console.log("fetching " + url);
    return fetch(url)
        .then(response => response.json())
        .then(gltf => loadBuffers(gl, gltf))
        .then(gltf => loadScene(gl, gltf))
    ;
}
function loadBuffers(gl, gltf) {
    if (
        gltf.buffers
        .filter(buffer => buffer.reader === undefined)
        .length > 0
    ) {
        let promises = [];
        for (let buffer of gltf.buffers) {
            if (buffer.reader === undefined) {
                buffer.reader = new FileReader();
                console.log("fetching " + buffer.uri);
                fetch(buffer.uri)
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
    } else { console.log("all buffers are already loaded"); }
}
function loadScene(gl, gltf) {
    if (gltf.scene === undefined) console.log("no scene to load");
    else {
        let scene = gltf.scenes[gltf.scene];
        for (let node of scene.nodes) {
            node = gltf.nodes[node];
            if (node.mesh !== undefined) {
                let mesh = gltf.meshes[node.mesh];
                for (let primitive of mesh.primitives) {
                    let attributes = primitive.attributes,
                        vertices   = getAccessorData(gltf, attributes.POSITION),
                        normals    = getAccessorData(gltf, attributes.NORMAL),
                        texCoords  = getAccessorData(gltf, attributes.TEXCOORD_0);

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
                        let indices   = getAccessorData(gltf, primitive.indices);
                        gl.bindBuffer(gl.ARRAY_BUFFER, null);

                        primitive.indexObject = gl.createBuffer();
                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexObject);
                        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
                        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.box.indexObject);

                        primitive.numIndices = indices.length;
                    }

                    primitive.texture = loadImageTexture(
                        gl,
                        gltf.images[
                            gltf.materials[primitive.material]
                            .pbrMetallicRoughness
                            .baseColorTexture
                            .index
                        ].uri
                    );
                }
            }
        }
        return gltf;
    }
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
