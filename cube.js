function main() {
    var canvas = document.getElementById('map-canvas');
    gl = WebGLUtils.setupWebGL(canvas);

    var vertices = [
        -1,-1,-1, 1,-1,-1, 1, 1,-1, -1, 1,-1,
        -1,-1, 1, 1,-1, 1, 1, 1, 1, -1, 1, 1,
        -1,-1,-1, -1, 1,-1, -1, 1, 1, -1,-1, 1,
        1,-1,-1, 1, 1,-1, 1, 1, 1, 1,-1, 1,
        -1,-1,-1, -1,-1, 1, 1,-1, 1, 1,-1,-1,
        -1, 1,-1, -1, 1, 1, 1, 1, 1, 1, 1,-1, 
    ];

    var colors = [
        5,3,7, 5,3,7, 5,3,7, 5,3,7,
        1,1,3, 1,1,3, 1,1,3, 1,1,3,
        0,0,1, 0,0,1, 0,0,1, 0,0,1,
        1,0,0, 1,0,0, 1,0,0, 1,0,0,
        1,1,0, 1,1,0, 1,1,0, 1,1,0,
        0,1,0, 0,1,0, 0,1,0, 0,1,0 
    ];

    var indices = [
        0,1,2, 0,2,3, 4,5,6, 4,6,7,
        8,9,10, 8,10,11, 12,13,14, 12,14,15,
        16,17,18, 16,18,19, 20,21,22, 20,22,23 
    ];

    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    var color_buffer = gl.createBuffer ();
    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    var index_buffer = gl.createBuffer ();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    var vertCode = 'attribute vec3 position;'+
        'uniform mat4 Pmatrix;'+
        'uniform mat4 Vmatrix;'+
        'uniform mat4 Mmatrix;'+
        'attribute vec3 color;'+//the color of the point
        'varying vec3 vColor;'+
        'void main(void) { '+//pre-built function
            'gl_Position = Pmatrix*Vmatrix*Mmatrix*vec4(position, 1.);'+
                'vColor = color;'+
                '}';

    var fragCode = 'precision mediump float;'+
        'varying vec3 vColor;'+
        'void main(void) {'+
            'gl_FragColor = vec4(vColor, 1.);'+
                '}';

    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);

    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);

    var shaderprogram = gl.createProgram();
    gl.attachShader(shaderprogram, vertShader); 
    gl.attachShader(shaderprogram, fragShader);
    gl.linkProgram(shaderprogram);

    var _Pmatrix = gl.getUniformLocation(shaderprogram, "Pmatrix");
    var _Vmatrix = gl.getUniformLocation(shaderprogram, "Vmatrix");
    var _Mmatrix = gl.getUniformLocation(shaderprogram, "Mmatrix");

    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    var _position = gl.getAttribLocation(shaderprogram, "position");
    gl.vertexAttribPointer(_position, 3, gl.FLOAT, false,0,0);
    gl.enableVertexAttribArray(_position);

    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    var _color = gl.getAttribLocation(shaderprogram, "color");
    gl.vertexAttribPointer(_color, 3, gl.FLOAT, false,0,0) ;
    gl.enableVertexAttribArray(_color);
    gl.useProgram(shaderprogram);

    function get_projection(angle, a, zMin, zMax) {
        var ang = Math.tan((angle*.5)*Math.PI/180);//angle*.5
        return mat4.fromValues(
            0.5/ang, 0 , 0, 0,
            0, 0.5*a/ang, 0, 0,
            0, 0, -(zMax+zMin)/(zMax-zMin), -1,
            0, 0, (-2*zMax*zMin)/(zMax-zMin), 0 
        );
    }

    var proj_matrix = get_projection(40, canvas.width/canvas.height, 1, 100);
    var mo_matrix = mat4.create();
    var view_matrix = mat4.create();

    view_matrix[14] = view_matrix[14]-6;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0,0,canvas.width,canvas.height);

    function turn (X, Y) {
	// for the math, see http://www.texpaste.com/n/ev3443eo
        var
            X2 = X*X, Y2 = Y*Y,
            q = 1 + X2 + Y2,
            s = 1 - X2 - Y2,
            r2 = 1/(q*q), s2 = s*s,
            A = (s2 + 4*(Y2 - X2))*r2, B = -8*X*Y*r2, C = 4*s*X*r2,
                D = (s2 + 4*(X2 - Y2))*r2, E = 4*s*Y*r2,
                    F = (s2 - 4*(X2 + Y2))*r2;
        mat4.multiply(mo_matrix, [
                     A,  B, C, 0,
                     B,  D, E, 0,
                    -C, -E, F, 0,
                     0,  0, 0, 1
                    ],
                mo_matrix);
    }
    // MOUSE MANAGEMENT
    var AMORTIZATION = 0.9;
    var drag = false;
    var old_x, old_y;
    var X = 0, Y = 0;

    canvas.addEventListener("mousedown",
            function (e) {
                drag = true, old_x = e.pageX, old_y = e.pageY;
                e.preventDefault();
                return false;
            }, false
    );
    canvas.addEventListener("mouseup", function (e) { drag = false });
    canvas.addEventListener("mousemove",
            function(e) {
                if (!drag) return false;
                    X = -(e.pageX-old_x)/canvas.width,
                    Y = (e.pageY-old_y)/canvas.height;
                turn(X, Y);
                old_x = e.pageX, old_y = e.pageY;
                e.preventDefault();
            }, false
    );
         

    var animate = function () {
        gl.clearColor(0.5, 0.5, 0.5, 0.9);
        gl.clearDepth(1.0);
        gl.viewport(0.0, 0.0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!drag) {
            X *= AMORTIZATION;
            Y *= AMORTIZATION;
            turn(X, Y);
        }
        gl.uniformMatrix4fv(_Pmatrix, false, proj_matrix);
        gl.uniformMatrix4fv(_Vmatrix, false, view_matrix);
        gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
                                        
        window.requestAnimationFrame(animate);
    }

    animate();

}
