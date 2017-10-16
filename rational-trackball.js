"use strict";

let mo_matrix;
function reset() {
    mo_matrix = [
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    ].map(x => bigRat(x));
}
reset();

function turn(X, Y) {
    let X2 = X.multiply(X), Y2 = Y.multiply(Y),
        q  = bigRat(1).add     (X2.add(Y2)),
        s  = bigRat(1).subtract(X2.add(Y2)),
        q2 = q.multiply(q), s2 = s.multiply(s),
        A = s2.add(bigRat(4).multiply(Y2.subtract(X2))).divide(q2),
        B = bigRat(-8).multiply(X).multiply(Y).divide(q2),
        C = bigRat(4).multiply(s).multiply(X).divide(q2),
        D = s2.add(bigRat(4).multiply(X2.subtract(Y2))).divide(q2),
        E = bigRat(4).multiply(s).multiply(Y).divide(q2),
        F = s2.subtract(bigRat(4).multiply(X2.add(Y2))).divide(q2);
        return [
            A         , B         , C         , bigRat(0) ,
            B         , D         , E         , bigRat(0) ,
            C.negate(), E.negate(), F         , bigRat(0) ,
            bigRat(0) , bigRat(0) , bigRat(0) , bigRat(1)
        ];
}

function multiply(out, a, b) {
    let a00 = a[ 0], a01 = a[ 1], a02 = a[ 2], a03 = a[ 3],
        a10 = a[ 4], a11 = a[ 5], a12 = a[ 6], a13 = a[ 7],
        a20 = a[ 8], a21 = a[ 9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0.multiply(a00).add(b1.multiply(a10)).add(b2.multiply(a20)).add(b3.multiply(a30));
    out[1] = b0.multiply(a01).add(b1.multiply(a11)).add(b2.multiply(a21)).add(b3.multiply(a31));
    out[2] = b0.multiply(a02).add(b1.multiply(a12)).add(b2.multiply(a22)).add(b3.multiply(a32));
    out[3] = b0.multiply(a03).add(b1.multiply(a13)).add(b2.multiply(a23)).add(b3.multiply(a33));

        b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0.multiply(a00).add(b1.multiply(a10)).add(b2.multiply(a20)).add(b3.multiply(a30));
    out[5] = b0.multiply(a01).add(b1.multiply(a11)).add(b2.multiply(a21)).add(b3.multiply(a31));
    out[6] = b0.multiply(a02).add(b1.multiply(a12)).add(b2.multiply(a22)).add(b3.multiply(a32));
    out[7] = b0.multiply(a03).add(b1.multiply(a13)).add(b2.multiply(a23)).add(b3.multiply(a33));

        b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8 ] = b0.multiply(a00).add(b1.multiply(a10)).add(b2.multiply(a20)).add(b3.multiply(a30));
    out[9 ] = b0.multiply(a01).add(b1.multiply(a11)).add(b2.multiply(a21)).add(b3.multiply(a31));
    out[10] = b0.multiply(a02).add(b1.multiply(a12)).add(b2.multiply(a22)).add(b3.multiply(a32));
    out[11] = b0.multiply(a03).add(b1.multiply(a13)).add(b2.multiply(a23)).add(b3.multiply(a33));

        b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0.multiply(a00).add(b1.multiply(a10)).add(b2.multiply(a20)).add(b3.multiply(a30));
    out[13] = b0.multiply(a01).add(b1.multiply(a11)).add(b2.multiply(a21)).add(b3.multiply(a31));
    out[14] = b0.multiply(a02).add(b1.multiply(a12)).add(b2.multiply(a22)).add(b3.multiply(a32));
    out[15] = b0.multiply(a03).add(b1.multiply(a13)).add(b2.multiply(a23)).add(b3.multiply(a33));
    return out;
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
        return [
            0.5/ang, 0 , 0, 0,
            0, 0.5*a/ang, 0, 0,
            0, 0, -(zMax+zMin)/(zMax-zMin), -1,
            0, 0, (-2*zMax*zMin)/(zMax-zMin), 0 
        ];
    }

    let proj_matrix = get_projection(40, canvas.width/canvas.height, 1, 100),
        view_matrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

    view_matrix[14] = view_matrix[14]-6;
    mo_matrix.copy = mo_matrix.map(x => bigRat(x));

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0,0,canvas.width,canvas.height);
    canvas.maxLength = Math.max(canvas.width, canvas.height);

    {
        // MOUSE MANAGEMENT
        let drag = false, old_x, old_y;

        canvas.addEventListener("mousedown",
            function (e) {
                mo_matrix.copy = mo_matrix.map(x => bigRat(x));
                drag = true, old_x = e.pageX, old_y = e.pageY;
                e.preventDefault();
                return false;
            }, false
        );
        document.addEventListener("mouseup", function (e) { drag = false; });
        document.addEventListener("mousemove",
            function(e) {
                if (!drag) return false;
                multiply(
                    mo_matrix,
                    turn(
                        bigRat(-(e.pageX-old_x),canvas.maxLength),
                        bigRat(+(e.pageY-old_y),canvas.maxLength)
                    ),
                    mo_matrix.copy
                );
                e.preventDefault();
            }, false
        );
    }

    let a00 = document.getElementById("a00"),
        a00value = document.getElementById("a00value");
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

        a00.innerHTML = 'a00 = ' + mo_matrix[0].toString();
        a00value.innerHTML = 'a00.valueOf() = ' + mo_matrix[0].valueOf();
        window.requestAnimationFrame(animate);
    }

    animate();

}
