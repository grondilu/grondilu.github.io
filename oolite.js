var Oolite = Oolite || function () {

    function convertStarCatalog(catalog) {
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

    // Below are classes declations.
    // For heritage model I followed
    // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Object/create


    // OBJECT3D
    // This ia a base class for objects in a scene (the scene itself being a particular Object3D)
    // They are mainly characterized by an Euclidean transform represented as a matrix
    // They can have children, whose matrix is a local transformation
    var Object3D = (function () {
	var count = 0;
	return function () {
	    this.id = Date.now() + '#' + count++;
	    this.matrix = mat4.create();
	    this.children = [];
	    for (var i = 0, child; child = arguments[i]; i++) {
		this.adopt(child);
	    }
	}
    })();
    Object3D.prototype.rotateX = function (angle) { mat4.rotateX(this.matrix, this.matrix, angle); return this; }
    Object3D.prototype.rotateY = function (angle) { mat4.rotateY(this.matrix, this.matrix, angle); return this; }
    Object3D.prototype.rotateZ = function (angle) { mat4.rotateZ(this.matrix, this.matrix, angle); return this; }
    Object3D.prototype.translate = function (v)   { mat4.translate(this.matrix, this.matrix, v); return this; }
    Object3D.prototype.adopt = function (child) {
	if (child.id == this.id) {
	    console.log("attempt of relexive adoption");
	    return null;
	} else if (this.children.indexOf(child) != -1) {
	    console.log("attempt to adopt an already adopted child");
	    return null;
	} else {
	    this.children.push(child);
	    child.parent = this;
	}
    }

    // SCENE
    var Scene = function () {
	Object3D.apply(this, arguments);
    };
    Scene.prototype = Object.create(Object3D.prototype);
    Scene.prototype.constructor = Scene;

    var PointCloud = function ( data ) {
	Object3D.call(this);
	this.positionArray = data.position;
	this.intensityArray = data.intensity;
    };
    PointCloud.prototype = Object.create(Object3D.prototype);
    PointCloud.prototype.constructor = PointCloud;

    // CAMERA
    function Camera(fovy, aspect) {
	Object3D.call(this);
	fovy = fovy || Math.PI/4;
	aspect = aspect || canvas.width / canvas.height;
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
    }
    Camera.prototype = Object.create(Object3D.prototype);
    Camera.prototype.constructor = Camera;

    // MESH
    function Mesh(geometry) {
	Object3D.call(this);
	geometry = geometry || {};
	this.vertices = geometry.vertices || [];
	this.faces = geometry.faces || [];
	this.normals = geometry.normals || [];
	this.texture = {};
	this.texture.coordinates = geometry.texture.coordinates || [];
	this.texture.offsets = geometry.texture.offsets || [];
	this.texture.images = geometry.texture.images || [];
	this.texture.flipY = geometry.texture.flipY || [];
    }
    Mesh.prototype = Object.create(Object3D.prototype);
    Mesh.prototype.constructor = Mesh;

    // RENDERER
    function Renderer(webGLContext) {
	if (!webGLContext) { console.log("no WebGL context provided"); return null }
	var gl = webGLContext;
	gl.viewport(0, 0,
		gl.canvas.width = 600, // window.innerWidth,
		gl.canvas.height = 600 // window.innerHeight
		);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	var buffers = {};
	mat4.stack = [ ];
	mat4.pushProduct = function (matrix) {
	    if (mat4.stack.length == 0) { mat4.stack.push(matrix) }
	    else {
		var product;
		mat4.mul(product = mat4.create(), mat4.stack[mat4.stack.length - 1], matrix);
		mat4.stack.push(product);
	    }
	};
	mat4.pop = function () {
	    if (mat4.stack.length == 0) {
		console.log("attempt to pop an empty stack");
		return null;
	    } else { return mat4.stack.pop() }
	};
	mat4.top = function () {
	    return mat4.stack[mat4.stack.length - 1] }

	var imageTexturesDirectory = "images/textures/";

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
	    "attribute vec3 aVertexNormal;",
	    "attribute vec2 aTextureCoord;",
	    "uniform mat4 uMVMatrix;",
	    "uniform mat4 uPMatrix;",
	    "varying vec2 vTextureCoord;",

	    "varying float vDiffuseFactor;",

	    "void main(void) {",
	    "    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
	    "    vec4 projectedNormal = uMVMatrix * vec4(aVertexNormal, 0.0);",
	    "    vDiffuseFactor = max(0.0, -projectedNormal.x);",
	    "    vTextureCoord = aTextureCoord;",
	    "}"
	    ].join("\n"),
	    fragment : [
	    "precision mediump float;",
	    "varying vec2 vTextureCoord;",
	    "varying float vDiffuseFactor;",
	    "uniform sampler2D uSampler;",

	    "void main(void) {",
	    "     vec4 color = vDiffuseFactor * texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));",
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
	    "    gl_PointSize = 2.0;",
	    "    gl_Position = uPMatrix * uMVMatrix * aPoint;",
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

	this.render = function (obj, camera) {
	    //console.log("rendering object id " + obj.id + ", matrix stack depth is " + mat4.stack.length + ", top matrix is " + mat4.top());
	    if (!obj || !camera) { console.log("no object or no camera"); return null; }
	    if (!(obj instanceof Object3D)) { console.log("unexpected object type"); return null; }

	    if (camera.parent) { console.log("can't deal with child cameras yet, sorry"); return null; }
	    if (!obj.matrix) { console.log("unexpected empty matrix"); return null; }

	    if (obj instanceof Scene) {
		//console.log("rendering scene, id = " + obj.id);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		var inversecam = mat4.create();
		mat4.invert(inversecam, camera.matrix);
		mat4.stack = [ inversecam ];
	    } else if (!obj.parent) {
		console.log("object has no parent");
		return null;
	    } else if (!buffers[obj.id]) { loadObject(obj) }

	    if (!obj.matrix) { console.log("attempt to push an empty matrix"); return null; }
	    //console.log("pushing for id " + obj.id);
	    mat4.pushProduct(obj.matrix);
	    for (var i = 0, child; child = obj.children[i]; i++) {
		this.render(child, camera);
	    }
	    if (obj instanceof Camera) {
		console.log("attempt to render a camera");
		return null;
	    } else if (obj instanceof PointCloud) {
		var program = pointCloudProgram;
		gl.useProgram(program);
		var aPointLocation = gl.getAttribLocation(program, "aPoint");
		var aIntensityLocation = gl.getAttribLocation(program, "aIntensity");
		gl.enableVertexAttribArray(aPointLocation);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers[obj.id].position);
		gl.vertexAttribPointer(aPointLocation, 4, gl.FLOAT, false, 0, 0);

		gl.enableVertexAttribArray(aIntensityLocation);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers[obj.id].intensity);
		gl.vertexAttribPointer(aIntensityLocation, 1, gl.FLOAT, false, 0, 0);

		if (!mat4.top()) { console.log("unexpected nul top matrix for object id " + obj.id); return null; }
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMVMatrix"), false, mat4.top());
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "uPMatrix"), false, camera.pMatrix);

		gl.drawArrays(gl.POINTS, 0, Math.floor(obj.positionArray.length / 4));
	    } else if (obj instanceof Mesh) {
		var program = meshProgram;
		gl.useProgram(program);
		if (!mat4.top()) { console.log("unexpected nul top matrix for object id " + obj.id); return null; }
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMVMatrix"), false, mat4.top());
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "uPMatrix"), false, camera.pMatrix);

		var attributeLocation = {
		    aVertexPosition : gl.getAttribLocation(program, "aVertexPosition"),
		    aTextureCoord : gl.getAttribLocation(program, "aTextureCoord"),
		    aVertexNormal : gl.getAttribLocation(program, "aVertexNormal")
		};
		gl.enableVertexAttribArray(attributeLocation.aVertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers[obj.id].vertices);
		gl.vertexAttribPointer(attributeLocation.aVertexPosition, 3, gl.FLOAT, false, 0, 0);

		gl.enableVertexAttribArray(attributeLocation.aTextureCoord);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers[obj.id].texture.coordinates);
		gl.vertexAttribPointer(attributeLocation.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

		gl.enableVertexAttribArray(attributeLocation.aVertexNormal);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers[obj.id].normals);
		gl.vertexAttribPointer(attributeLocation.aVertexNormal, 3, gl.FLOAT, false, 0, 0);

		for (var i = 0, texture; texture = buffers[obj.id].texture[i]; i++) {
		    gl.activeTexture(gl.TEXTURE0 + i);
		    gl.bindTexture(gl.TEXTURE_2D, texture);
		    gl.uniform1i(gl.getUniformLocation(program, "uSampler"), i);

		    var offset = obj.texture.offsets[i];  // This offset is in number of faces!
		    var numFaces = (obj.texture.offsets[i + 1] || (Math.floor(obj.faces.length / 3))) - offset;
		    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[obj.id].faces);
		    gl.drawElements(gl.TRIANGLES, 3*numFaces, gl.UNSIGNED_SHORT, 3*2*offset);
		}
	    }
	    //console.log("popping for id " + obj.id);
	    mat4.pop();

	};
	function loadObject (obj) {
	    if (buffers[obj.id]) { console.log("unexpected reload of object " + obj.id); }
	    var bufs = { texture : [] };
	    if (obj instanceof PointCloud) {
		gl.bindBuffer(gl.ARRAY_BUFFER, bufs.position = gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, obj.positionArray, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufs.intensity = gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, obj.intensityArray, gl.STATIC_DRAW);
	    } else if (obj instanceof Mesh) {
		gl.bindBuffer(gl.ARRAY_BUFFER, bufs.vertices = gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.vertices), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.faces = gl.createBuffer());
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(obj.faces), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, bufs.normals = gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.normals), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, bufs.texture.coordinates = gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.texture.coordinates), gl.STATIC_DRAW);
		for (var i = 0, filename; filename = obj.texture.images[i]; i++) {
		    var glTexture = gl.createTexture();
		    bufs.texture.push( glTexture );
		    gl.activeTexture(gl.TEXTURE0 + i);
		    gl.bindTexture(gl.TEXTURE_2D, glTexture);
		    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
		    glTexture.image = new Image();
		    glTexture.image.src = imageTexturesDirectory + filename;
		    gl.bindTexture(gl.TEXTURE_2D, glTexture);
		    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, obj.texture.flipY[i] || false);
		    gl.texImage2D(    gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glTexture.image);
		    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		    gl.bindTexture(   gl.TEXTURE_2D, null);
		}

	    }
	    buffers[obj.id] = bufs;
	}
    }

    return {
	Object3D : Object3D,
	Renderer : Renderer,
		 PointCloud : PointCloud,
		 Scene : Scene,
		 Mesh : Mesh,
		 Camera : Camera,
		 convertStarCatalog : convertStarCatalog
    }
}();
