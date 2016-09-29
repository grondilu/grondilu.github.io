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

var utils = {
    rotation_matrix: function (X, Y) {
	var
	    X2 = X*X, Y2 = Y*Y,
	    q = 1 + X2 + Y2, s = 1 - X2 - Y2,
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
    },
    quadrance: function (v) { return v[0]*v[0]+v[1]*v[1]+v[2]*v[2]; }
}

function buildProgram(gl) {
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

    program.mMatrixUniform = gl.getUniformLocation(program, "uMMatrix");
    program.vMatrixUniform = gl.getUniformLocation(program, "uVMatrix");
    program.pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");

    program.setMatrixUniforms = function setMatrixUniforms(matrices) {
        gl.uniformMatrix4fv(program.pMatrixUniform, false, matrices.projection);
        gl.uniformMatrix4fv(program.mMatrixUniform, false, matrices.model);
        gl.uniformMatrix4fv(program.vMatrixUniform, false, matrices.view);
    }
    return program;
}
var DNA = {
    generate: function (length) {
        return [...Array(length)].map(
            x => "ACGT".substr(Math.floor(Math.random()*4), 1)
        ).join("");
    },
    checkValidity: function (sequence) {
        sequence = sequence.replace(/(\r\n|\n|\r)/gm,"");
        if (sequence.match(/[^CGATN]/)) {
            throw "given string does not look like a DNA sequence";
        }
    }
};
var buildModel = (function () {
    var model = { glBuffers: {} };
    var nucleotids = {
        A : { direction : [ 1.0,  1.0,  1.0], color : [1.0, 0.0, 0.0, 1.0] },
        C : { direction : [ 1.0, -1.0, -1.0], color : [0.0, 1.0, 0.0, 1.0] },
        G : { direction : [-1.0,  1.0, -1.0], color : [0.0, 0.0, 1.0, 1.0] },
        T : { direction : [-1.0, -1.0,  1.0], color : [1.0, 1.0, 0.0, 1.0] },
        N : { direction : [ 0.0,  0.0,  0.0], color : [0.0, 0.0, 0.0, 1.0] },
    };
    return function (gl, sequence) {
        if (model.glBuffers.vertices) { gl.deleteBuffer(model.glBuffers.vertices) }
        if (model.glBuffers.colors)   { gl.deleteBuffer(model.glBuffers.colors)   }
        DNA.checkValidity(sequence);
        var
            positions = [], vertices = [], colors = [],
            vertex = vec3.create();
        for (var i = 0; i < sequence.length; i++) {
            var nucleotid = nucleotids[sequence[i]];
            vec3.add(vertex, vertex, nucleotid.direction);
            var position = vertex.slice();
            vertices.push(...position);
            positions.push(position);
            colors.push(...nucleotid.color);
        }
        model.barycenter = vec3.scale([], positions.reduce((a, b) => vec3.add([], a, b), vec3.create()), 1/positions.length);
        model.radius = (function () {
	    return Math.sqrt(positions.reduce((a, b) => Math.max(a, utils.quadrance(vec3.subtract([], b, model.barycenter))), 0));
	})();

        model.glBuffers.vertices = gl.createBuffer();
        model.glBuffers.vertices.itemSize = 3;
        model.glBuffers.vertices.numItems = sequence.length;

        gl.bindBuffer(gl.ARRAY_BUFFER, model.glBuffers.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        model.glBuffers.colors = gl.createBuffer();
        model.glBuffers.colors.itemSize = 4;
        model.glBuffers.colors.numItems = sequence.length;

        gl.bindBuffer(gl.ARRAY_BUFFER, model.glBuffers.colors);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        return model;
    }
})();

function main() {
    
    var
        canvas = document.getElementById("canvas"),
        sequence = document.getElementById("sequence"),
        gl     = WebGLUtils.setupWebGL(canvas),
        program = buildProgram(gl);

    var matrices = {
        model:      mat4.create(),
        view:       mat4.create(),
        projection: (function () {
            var pMatrix = [];
            var near = 0.1, far = 1000.0; 
            mat4.perspective(pMatrix, 45, gl.canvas.width / gl.canvas.height, near, far);
            // put far plane at infinity
            pMatrix[10] = -1, pMatrix[14] = -2*near;
            return pMatrix;
        })()
    };

    var model;
    (function () {
        // mouse management
        var drag, X, Y, oldPageX, oldPageY, distance = m => m.radius * 2;
        gl.canvas.addEventListener("mouseup",   function (e) { drag = false });
        gl.canvas.addEventListener("mousedown", function (e) { if (e.button == 1) { console.log("middle button pressed"); } else if (e.button == 0) { drag = true, oldPageX = e.pageX, oldPageY = e.pageY; e.preventDefault(); }; return false; }, false);
        gl.canvas.addEventListener("mousemove", function (e) { if (!drag) return false; X = -(e.pageX-oldPageX)/canvas.width, Y = (e.pageY-oldPageY)/canvas.height; mat4.multiply( matrices.model, utils.rotation_matrix(X, Y), matrices.model); oldPageX = e.pageX, oldPageY = e.pageY; e.preventDefault(); }, false);
        gl.canvas.addEventListener("wheel", function (e) { matrices.view[14] = Math.min(0, matrices.view[14]+e.deltaY/1000*distance(model)); e.preventDefault() });
    })();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.disable(gl.DEPTH_TEST);
    gl.lineWidth(5.0);

    function updateWebGLBuffers(sequence) {
        matrices.view  = mat4.create();
        if (model) { mat4.multiply(matrices.model, matrices.model, mat4.translate([], mat4.create(), model.barycenter)); }
        
        model = buildModel(gl, 'N' + sequence);

        distance = model.radius * 2;
        mat4.translate(matrices.view, matrices.view, [0, 0, -distance]);
        mat4.translate(matrices.model, matrices.model, model.barycenter.map(x => -x));

        gl.bindBuffer(gl.ARRAY_BUFFER, model.glBuffers.vertices);
        gl.vertexAttribPointer(program.vertexPositionAttribute, model.glBuffers.vertices.itemSize, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, model.glBuffers.colors);
        gl.vertexAttribPointer(program.vertexColorAttribute, model.glBuffers.colors.itemSize, gl.FLOAT, false, 0, 0);
    }
    updateWebGLBuffers(sequence.value);
        
    document.getElementById("submit").addEventListener("click", function () { updateWebGLBuffers(sequence.value) } );
    document.getElementById("random").addEventListener("click",
            function () {
                sequence.value = DNA.generate(1000);
                updateWebGLBuffers(sequence.value);
            }
    );

    (function animate() {
        (function () {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            program.setMatrixUniforms(matrices);
            gl.drawArrays(gl.LINE_STRIP, 0, model.glBuffers.vertices.numItems);
        })();
        requestAnimationFrame(animate);
    })();

    var fileSelector = document.getElementById("file");
    fileSelector.addEventListener("change",
        function () {
            if (fileSelector.files.length > 1) {
                alert("please select only one file");
                return;
            }
            console.log("picked file " + fileSelector.files[0].name);
        }
    );

}
