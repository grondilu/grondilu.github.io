function turn(X, Y) {
    let X2 = X*X, Y2 = Y*Y,
        q  = 1 + X2 + Y2,
        s  = 1 - X2 - Y2,
        r2 = 1/(q*q), s2 = s*s,
        A  = (s2 + 4*(Y2 - X2))*r2, B = -8*X*Y*r2, C = 4*s*X*r2,
        D  = (s2 + 4*(X2 - Y2))*r2, E = 4*s*Y*r2,
        F  = (s2 - 4*(X2 + Y2))*r2;
    return [
        A, B, C, 0,
        B, D, E, 0,
        -C,-E, F, 0,
        0, 0, 0, 1
    ];
}

function main() {
    let canvas   = document.getElementById('canvas'),
        gl       = WebGLUtils.setupWebGL(canvas),
        cube     = {
            vertices: [
                -1, -1, -1, +1, -1, -1, +1, +1, -1, -1, +1, -1,
                -1, -1, +1, +1, -1, +1, +1, +1, +1, -1, +1, +1,
                -1, -1, -1, -1, +1, -1, -1, +1, +1, -1, -1, +1,
                +1, -1, -1, +1, +1, -1, +1, +1, +1, +1, -1, +1,
                -1, -1, -1, -1, -1, +1, +1, -1, +1, +1, -1, -1,
                -1, +1, -1, -1, +1, +1, +1, +1, +1, +1, +1, -1,
            ],
            colors: [
                // #FFA500
                1,.65,0, 1,.65,0, 1,.65,0, 1,.65,0,
                1,1,1, 1,1,1, 1,1,1, 1,1,1,
                0,0,1, 0,0,1, 0,0,1, 0,0,1,
                1,0,0, 1,0,0, 1,0,0, 1,0,0,
                1,1,0, 1,1,0, 1,1,0, 1,1,0,
                0,1,0, 0,1,0, 0,1,0, 0,1,0 
            ],
            indices: [
                0,  1, 2,  0, 2, 3,  4, 5, 6,  4, 6, 7,
                8,  9,10,  8,10,11, 12,13,14, 12,14,15,
                16,17,18, 16,18,19, 20,21,22, 20,22,23 
            ]
        };

    let vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube.vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    let color_buffer = gl.createBuffer ();
    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube.colors), gl.STATIC_DRAW);

    let index_buffer = gl.createBuffer ();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cube.indices), gl.STATIC_DRAW);

    let vertCode = `
    attribute vec3 position;
    uniform mat4 Pmatrix;
    uniform mat4 Vmatrix;
    uniform mat4 Mmatrix;
    attribute vec3 color;
    varying vec3 vColor;
    void main(void) {
        gl_Position = Pmatrix*Vmatrix*Mmatrix*vec4(position, 1.);
    vColor = color;
    }`,
        fragCode = `
    precision mediump float;
    varying vec3 vColor;
    void main(void) {
    gl_FragColor = vec4(vColor, 1.);
    }`;

    let vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);

    let fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);

    let shaderprogram = gl.createProgram();
    gl.attachShader(shaderprogram, vertShader); 
    gl.attachShader(shaderprogram, fragShader);
    gl.linkProgram(shaderprogram);

    let _Pmatrix = gl.getUniformLocation(shaderprogram, "Pmatrix"),
        _Vmatrix = gl.getUniformLocation(shaderprogram, "Vmatrix"),
        _Mmatrix = gl.getUniformLocation(shaderprogram, "Mmatrix");

    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    let _position = gl.getAttribLocation(shaderprogram, "position");
    gl.vertexAttribPointer(_position, 3, gl.FLOAT, false,0,0);
    gl.enableVertexAttribArray(_position);

    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    let _color = gl.getAttribLocation(shaderprogram, "color");
    gl.vertexAttribPointer(_color, 3, gl.FLOAT, false,0,0) ;
    gl.enableVertexAttribArray(_color);
    gl.useProgram(shaderprogram);

    function get_projection(angle, a, zMin, zMax) {
        let ang = Math.tan((angle*.5)*Math.PI/180);//angle*.5
        return mat4.fromValues(
            0.5/ang, 0 , 0, 0,
            0, 0.5*a/ang, 0, 0,
            0, 0, -(zMax+zMin)/(zMax-zMin), -1,
            0, 0, (-2*zMax*zMin)/(zMax-zMin), 0 
        );
    }

    let proj_matrix = get_projection(40, canvas.width/canvas.height, 1, 100),
        mo_matrix   = mat4.create(),
        view_matrix = mat4.create();

    mo_matrix.copy = mat4.create();
    view_matrix[14] = view_matrix[14]-6;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0,0,canvas.width,canvas.height);
    canvas.maxLength = Math.max(canvas.width, canvas.height);

    {
        // MOUSE MANAGEMENT
        let drag = false, old_x, old_y;

        canvas.addEventListener("mousedown",
            function (e) {
                mat4.copy(mo_matrix.copy, mo_matrix);
                drag = true, old_x = e.pageX, old_y = e.pageY;
                e.preventDefault();
                return false;
            }, false
        );
        document.addEventListener("mouseup", function (e) { drag = false; });
        document.addEventListener("mousemove",
            function(e) {
                if (!drag) return false;
                mat4.multiply(
                    mo_matrix,
                    turn(
                        -(e.pageX-old_x)/canvas.maxLength,
                        +(e.pageY-old_y)/canvas.maxLength
                    ),
                    mo_matrix.copy
                );
                e.preventDefault();
            }, false
        );
    }

    let animate = function () {
        gl.clearColor(0.5, 0.5, 0.5, 0.9);
        gl.clearDepth(1.0);
        gl.viewport(0.0, 0.0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(_Pmatrix, false, proj_matrix);
        gl.uniformMatrix4fv(_Vmatrix, false, view_matrix);
        gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
        gl.drawElements(gl.TRIANGLES, cube.indices.length, gl.UNSIGNED_SHORT, 0);

        window.requestAnimationFrame(animate);
    }

    animate();

}
