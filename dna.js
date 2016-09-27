/****************************************************************************
 * Copyright (c) 2016 Lucien Grondin <grondilu@yahoo.fr>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *****************************************************************************/

function rotation_matrix (X, Y) {
    var X2 = X*X, Y2 = Y*Y;
    var q = 1 + X2 + Y2, s = 1 - X2 - Y2,
        r2 = 1/(q*q), s2 = s*s,
        A = (s2 + 4*(Y2 - X2))*r2, B = -8*X*Y*r2,
        C = 4*s*X*r2, D = (s2 + 4*(X2 - Y2))*r2,
        E = 4*s*Y*r2, F = (s2 - 4*(X2 + Y2))*r2;
    return mat4.fromValues(
        A,  B, C, 0,
        B,  D, E, 0,
       -C, -E, F, 0,
        0,  0, 0, 1
    );
}

function generate(length) {
    document.getElementById("sequence").value = 
    [...Array(length)].map(
        x => "ACGT".substr(Math.floor(Math.random()*4), 1)
    ).join("");
}

function checkValidity(sequence) {
    sequence = sequence.replace(/(\r\n|\n|\r)/gm,"");
    if (sequence.match(/[^CGATN]/)) {
        throw "given string does not look like a DNA sequence";
    }
    return sequence;
}

function show_dna_sequence(gl, sequence) {
    if (sequence.value.length == 0) { return; }

    var program = (function () {
        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(
            fragmentShader,
            `precision mediump float;
            varying vec4 vColor;
            void main(void) {
                gl_FragColor = vColor;
            }`
        ); 
        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(
                vertexShader,
                `attribute vec3 aVertexPosition;
                attribute vec4 aVertexColor;
                uniform mat4 uVMatrix;
                uniform mat4 uMMatrix;
                uniform mat4 uPMatrix;
                varying vec4 vColor;
                void main(void) {
                    vColor = aVertexColor;
                    gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aVertexPosition, 1.0);
                    gl_PointSize = 5.0;
                }`
                );
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) { alert(gl.getShaderInfoLog(fragmentShader)); return null; }
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) { alert(gl.getShaderInfoLog(vertexShader)); return null; }

        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { alert("could not compile shader program"); return null; }

        gl.useProgram(program);
        gl.enableVertexAttribArray(program.vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition"));
        gl.enableVertexAttribArray(program.vertexColorAttribute = gl.getAttribLocation(program, "aVertexColor"));

        program.pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
        program.mMatrixUniform = gl.getUniformLocation(program, "uMMatrix");
        program.vMatrixUniform = gl.getUniformLocation(program, "uVMatrix");

        program.setMatrixUniforms = function setMatrixUniforms(matrices) {
            gl.uniformMatrix4fv(program.pMatrixUniform, false, matrices.projection);
            gl.uniformMatrix4fv(program.mMatrixUniform, false, matrices.motion);
            gl.uniformMatrix4fv(program.vMatrixUniform, false, matrices.view);
        }
        return program;
    })();

    var processSequence = (function () {
        var buffers = {};
        var nucleotids = {
            A : { direction : [ 1.0,  1.0,  1.0], color : [1.0, 0.0, 0.0, 1.0] },
            C : { direction : [ 1.0, -1.0, -1.0], color : [0.0, 1.0, 0.0, 1.0] },
            G : { direction : [-1.0,  1.0, -1.0], color : [0.0, 0.0, 1.0, 1.0] },
            T : { direction : [-1.0, -1.0,  1.0], color : [1.0, 1.0, 0.0, 1.0] },
            N : { direction : [ 0.0,  0.0,  0.0], color : [0.0, 0.0, 0.0, 1.0] },
        };

        return function (sequence) {
            var positions = [];
            sequence = checkValidity(sequence);
            if (buffers.vertices) { gl.deleteBuffer(buffers.vertices) }
            if (buffers.colors)   { gl.deleteBuffer(buffers.colors)   }
            var vertices = [], colors = [], vertex = vec3.create();
            sequence.split("").map(n => nucleotids[n]).forEach(
                function (dc) {
                    vec3.add(vertex, vertex, dc.direction);
                    var v = vertex.slice();
                    vertices.push(...v);
                    positions.push(v);
                    colors.push(...dc.color);
                }
            );
            var radius = Math.sqrt(positions.reduce((a, b) => Math.max(a, b[0]*b[0] + b[1]*b[1] + b[2]*b[2]), 0));
            buffers.vertices = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
            buffers.vertices.itemSize = 3;
            buffers.vertices.numItems = sequence.length;
            gl.vertexAttribPointer(program.vertexPositionAttribute, buffers.vertices.itemSize, gl.FLOAT, false, 0, 0);

            buffers.colors = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colors);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
            buffers.colors.itemSize = 4;
            buffers.colors.numItems = sequence.length;
            gl.vertexAttribPointer(program.vertexColorAttribute, buffers.colors.itemSize, gl.FLOAT, false, 0, 0);

            return {
                buffers: buffers,
                positions: positions,
                radius: radius
            };
        }
    })();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.disable(gl.DEPTH_TEST);
    gl.lineWidth(5.0);

    function buildDrawSceneFunction() {
        var mMatrix = mat4.create();
        var vMatrix = mat4.create();
        var pMatrix = mat4.create();
        mat4.perspective(pMatrix, 45, gl.canvas.width / gl.canvas.height, 0.1, 100000.0);
        var processedSequence = processSequence(sequence.value);

        var distance = processedSequence.radius * 1.1;
        mat4.translate(vMatrix, vMatrix, [0, 0, -distance]);

        gl.canvas.addEventListener("wheel", function (e) {
            vMatrix[14] = Math.min(vMatrix[14]+e.deltaY/2, 0);
            e.preventDefault();
        });

        var buffers = processedSequence.buffers;

        var middle = vec3.scale([], processedSequence.positions.reduce((a, b) => vec3.add([], a, b), vec3.create()), 1/processedSequence.positions.length);
        mat4.translate(mMatrix, mMatrix, middle.map(x => -x));

        var drag, X, Y, oldPageX, oldPageY;
        gl.canvas.addEventListener("mouseup", function (e) { drag = false });
        gl.canvas.addEventListener("mousedown",
            function (e) {
                if (e.button == 1) {
                    console.log("middle button pressed");
                } else if (e.button == 0) {
                    drag = true, oldPageX = e.pageX, oldPageY = e.pageY;
                    e.preventDefault();
                }
                return false;
            }, false
        );
        gl.canvas.addEventListener("mousemove",
            function(e) {
                if (!drag) return false;
                X = -(e.pageX-oldPageX)/canvas.width,
                    Y = (e.pageY-oldPageY)/canvas.height;
                mat4.multiply(mMatrix, rotation_matrix(X, Y), mMatrix);
                oldPageX = e.pageX, oldPageY = e.pageY;
                e.preventDefault();
            }, false
        );
        return function () {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            program.setMatrixUniforms({
                projection: pMatrix,
                motion:     mMatrix,
                view:       vMatrix
            });
            gl.drawArrays(gl.LINE_STRIP, 0, buffers.vertices.numItems);
        }
    }

    var drawScene = buildDrawSceneFunction();

    document.getElementById("submit").addEventListener("click",
            function () { drawScene = buildDrawSceneFunction(); }
    );
    document.getElementById("random").addEventListener("click",
            function () { generate(1000); drawScene = buildDrawSceneFunction(); }
    );
    (function animate() { drawScene(); window.requestAnimationFrame(animate); })();
}

function main() {
    var canvas = document.getElementById("canvas");
    var gl = WebGLUtils.setupWebGL(canvas);
    show_dna_sequence(
        gl,
        document.getElementById("sequence")
    );
}
