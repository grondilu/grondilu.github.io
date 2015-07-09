function StarCatalog(webGLContext, catalog) {
    var shader_sources = {
	fragment : [
	"precision mediump float;",
	"varying float vIntensity;",
	"void main(void) {",
	"    gl_FragColor = vec4(vIntensity, vIntensity, vIntensity, 1.0);",
	"}"
	].join("\n"),
	vertex : [
	"attribute vec4 aStar;",
	"uniform mat4 uMVMatrix;",
	"uniform mat4 uPMatrix;",
	"varying float vIntensity;",
	"void main(void) {",
	    "gl_PointSize = 1.0;",
	    "gl_Position = uPMatrix * uMVMatrix * vec4(aStar.xyz, 1.0);",
	    "vIntensity = aStar.w;",
	    "}"
	].join("\n")
    };

    var fragmentShader = webGLContext.createShader(webGLContext.FRAGMENT_SHADER),
    vertexShader = webGLContext.createShader(webGLContext.VERTEX_SHADER);
    webGLContext.shaderSource(fragmentShader, shader_sources.fragment);
    webGLContext.shaderSource(vertexShader, shader_sources.vertex);
    webGLContext.compileShader(fragmentShader);
    webGLContext.compileShader(vertexShader);

    var shaderProgram = webGLContext.createProgram();
    webGLContext.attachShader(shaderProgram, vertexShader);
    webGLContext.attachShader(shaderProgram, fragmentShader);
    webGLContext.linkProgram(shaderProgram);

    webGLContext.enableVertexAttribArray(webGLContext.getAttribLocation(shaderProgram, "aStar"));

    var glBuffer = webGLContext.createBuffer();
    webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, glBuffer);
    var tmparray = [ ];
    if (Math.floor(catalog.length / 3) * 3 !== catalog.length) {
	alert("unexpected star catalog size");
	return;
    } else {
	//
	var radius = 1e6;
	for (var i = 0, ra, de, ma; catalog[i]; i+=3) {
	    // expected format is Right Ascention, Declination, Magnitude
	    ra = catalog[i];
	    de = catalog[i+1];
	    ma = catalog[i+2];
	    tmparray.push(
		    radius * Math.cos(de)*Math.cos(ra),
		    radius * Math.cos(de)*Math.sin(ra),
		    radius * Math.sin(de),
		    Math.min(1.0, Math.pow(2.52, 1.5 - ma))
	    );
	}
    }
    webGLContext.bufferData(webGLContext.ARRAY_BUFFER, new Float32Array(tmparray), webGLContext.STATIC_DRAW);
    glBuffer.itemSize = 4;
    glBuffer.numItems = Math.floor(tmparray.length / 4);

    this.draw = function (projectionMatrix, modelViewMatrix) {
	webGLContext.useProgram(shaderProgram);
	webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, glBuffer);
	webGLContext.vertexAttribPointer(shaderProgram.vertexPositionAttribute, glBuffer.itemSize, webGLContext.FLOAT, false, 0, 0);

	webGLContext.uniformMatrix4fv(webGLContext.getUniformLocation(shaderProgram, "uPMatrix"), false, [
		projectionMatrix[0], 0,  0,  0,
		0, projectionMatrix[5],  0,  0,
		0,                   0, -1,  -1,
		0,                   0, -2,  0
		]
	);
	webGLContext.uniformMatrix4fv(webGLContext.getUniformLocation(shaderProgram, "uMVMatrix"), false, modelViewMatrix);
	webGLContext.drawArrays(webGLContext.POINTS, 0, glBuffer.numItems);
    }
}
