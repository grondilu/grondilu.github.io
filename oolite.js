var Oolite = Oolite || function () {

    function Stars(catalog) {
	if (!catalog) { console.log("no catalog was given"); return null }
	if (catalog.length % 3) { console.log("unexpected catalog length"); return null }
	var tmpPositionArray = [ ], tmpIntensityArray = [ ];
	for (var i = 0, ra, de, ma; catalog[i]; i+=3) {
	    // expected format is Right Ascention, Declination, Magnitude
	    ra = catalog[i];
	    de = catalog[i+1];
	    ma = catalog[i+2];
	    tmpPositionArray.push(
		    Math.cos(de)*Math.cos(ra),
		    Math.cos(de)*Math.sin(ra),
		    Math.sin(de),
		    0
		    );
	    tmpIntensityArray.push(
		    Math.min(1.0, Math.pow(2.52, 1.1 - ma))
		    );
	}
	return {
	    position : new Float32Array( tmpPositionArray ),
		      intensity : new Float32Array( tmpIntensityArray )
	}
    }



    var Object3D = (function () {
	var count = 0;
	return function () {
	    this.id = Date.now() + '#' + count++;
	    this.matrix = mat4.create();
	}
    })();

    // For heritage model I followed
    // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Object/create
    var PointCloud = function ( data ) {
	Object3D.call(this);
	this.positionArray = data.position;
	this.intensityArray = data.intensity;
    };
    PointCloud.prototype = Object.create(Object3D.prototype);
    PointCloud.prototype.constructor = PointCloud;

    function Camera(fovy, aspect) {
	fovy = fovy || Math.PI/4;
	aspect = aspect || 1;
	this.pMatrix = (function () {
	    var f = 1.0 / Math.tan(fovy / 2);
	    var pMatrix = mat4.create();
	    pMatrix[0] = f / aspect;
	    pMatrix[5] = f;
	    pMatrix[10] = -0.9999;
	    pMatrix[11] = -1;
	    pMatrix[14] = -1
	    pMatrix[15] = 1;
	return pMatrix;
	})();
	this.matrix = mat4.create();
    }

    function Renderer(webGLContext) {
	if (!webGLContext) { console.log("no WebGL context provided"); return null }
	var gl = webGLContext;
	gl.viewport(0, 0,
		gl.canvas.width = 500, // window.innerWidth,
		gl.canvas.height = 500 // window.innerHeight
		);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	var buffers = {};

	function compileShader(src) {
	    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER),
		vertexShader = gl.createShader(gl.VERTEX_SHADER);
	    gl.shaderSource(fragmentShader, src.fragment);
	    gl.shaderSource(vertexShader, src.vertex);
	    gl.compileShader(fragmentShader);
	    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) { alert(gl.getShaderInfoLog(fragmentShader)); return null; }
	    gl.compileShader(vertexShader);
	    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) { alert(gl.getShaderInfoLog(vertexShader)); return null; }

	    var program = gl.createProgram();
	    gl.attachShader(program, vertexShader);
	    gl.attachShader(program, fragmentShader);
	    gl.linkProgram(program);
	    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { alert("could not compile shader program"); return null; }
	    return program;
	}

	var meshProgram = compileShader({
	    vertex : [
	    "attribute vec3 aVertexPosition;",
	    "attribute vec2 aTextureCoord;",
	    "uniform mat4 uMVMatrix;",
	    "uniform mat4 uPMatrix;",
	    "varying vec2 vTextureCoord;",

	    "void main(void) {",
	    "    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
	    "    vTextureCoord = aTextureCoord;",
	    "}"
	    ].join("\n"),
	    fragment : [
	    "precision mediump float;",
	    "varying vec2 vTextureCoord;",
	    "uniform sampler2D uSampler;",

	    "void main(void) {",
	    "     vec4 color = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));",
	    "     gl_FragColor = vec4(color.r, color.g, color.b, 1.0);",
	    "}",
	    ].join("\n")
	});
	var pointCloudProgram = compileShader({
	    vertex : [
	    "attribute vec4 aPoint;",
	    "attribute float aIntensity;",
	    "uniform mat4 uMVMatrix;",
	    "uniform mat4 uPMatrix;",
	    "varying float vIntensity;",
	    "void main(void) {",
	    "gl_PointSize = 2.0;",
	    "gl_Position = uPMatrix * uMVMatrix * aPoint;",
	    "vIntensity = aIntensity;",
	    "}"
	    ].join("\n"),
	    fragment : [
	    "precision mediump float;",
	    "varying float vIntensity;",
	    "void main(void) {",
	    "    gl_FragColor = vec4(vIntensity, vIntensity, vIntensity, 1.0);",
	    "}"
	    ].join("\n")
	});

	this.render = function (scene, camera) {
	    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	    if (!scene || !camera) { console.log("no scene or no camera"); return null; }

	    for (var i = 0, obj; obj = scene[i]; i++) {
		if (!obj instanceof Object3D) { console.log("unexpected object type"); return null; }
		if (!buffers[obj.id]) { loadObject(obj) }
		if (!buffers[obj.id]) { console.log("could not load object in GPU"); return null; }
		if (obj instanceof PointCloud) {
		    var program = pointCloudProgram;
		    gl.useProgram(program);
		    var aPointLocation = gl.getAttribLocation(program, "aPoint");
		    var aIntensityLocation = gl.getAttribLocation(program, "aIntensity");
		    gl.enableVertexAttribArray(aPointLocation);
		    gl.enableVertexAttribArray(aIntensityLocation);

		    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[obj.id].position);
		    gl.vertexAttribPointer(aPointLocation, 4, gl.FLOAT, false, 0, 0);

		    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[obj.id].intensity);
		    gl.vertexAttribPointer(aIntensityLocation, 1, gl.FLOAT, false, 0, 0);

		    var mvMatrix = mat4.create();
		    mat4.invert(mvMatrix, camera.matrix);
		    mat4.multiply(mvMatrix, obj.matrix, mvMatrix);
		    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMVMatrix"), false, mvMatrix);
		    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uPMatrix"), false, camera.pMatrix);

		    gl.drawArrays(gl.POINTS, 0, Math.floor(obj.positionArray.length / 4));
		}
	    }
	}

	function loadObject (obj) {
	    if (buffers[obj.id]) { console.log("unexpected reloading of object " + obj.id); }
	    var bufs = {};
	    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.position = gl.createBuffer());
	    gl.bufferData(gl.ARRAY_BUFFER, obj.positionArray, gl.STATIC_DRAW);
	    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.intensity = gl.createBuffer());
	    gl.bufferData(gl.ARRAY_BUFFER, obj.intensityArray, gl.STATIC_DRAW);
	    buffers[obj.id] = bufs;
	}

    }

    return {
	Renderer : Renderer,
		 PointCloud : PointCloud,
		 Camera : Camera,
		 Stars : Stars
    }
}();
