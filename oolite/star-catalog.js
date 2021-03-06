function StarCatalog(webGLContext, catalog) {
    var shaderProgram = compileShader(webGLContext, {
	fragment : [
	"precision mediump float;",
	"varying float vIntensity;",
	"void main(void) {",
	"    gl_FragColor = vec4(vIntensity, vIntensity, vIntensity, 1.0);",
	"}"
	].join("\n"),
	vertex : [
	"attribute vec4 aStar;",
	"attribute float aIntensity;",
	"uniform mat4 uMVMatrix;",
	"uniform mat4 uPMatrix;",
	"varying float vIntensity;",
	"void main(void) {",
	"gl_PointSize = 1.0;",
	"gl_Position = uPMatrix * uMVMatrix * aStar;",
	"vIntensity = aIntensity;",
	"}"
	].join("\n")
    }
    );

    webGLContext.enableVertexAttribArray(webGLContext.getAttribLocation(shaderProgram, "aStar"));
    webGLContext.enableVertexAttribArray(webGLContext.getAttribLocation(shaderProgram, "aIntensity"));

    var tmpPositionArray = [ ];
    var tmpIntensityArray = [ ];
    if (Math.floor(catalog.length / 3) * 3 !== catalog.length) {
        alert("unexpected star catalog size");
        return;
    } else {
        //
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
    }
    var glPositionBuffer = webGLContext.createBuffer();
    webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, glPositionBuffer);
    webGLContext.bufferData(webGLContext.ARRAY_BUFFER, new Float32Array(tmpPositionArray), webGLContext.STATIC_DRAW);
    glPositionBuffer.itemSize = 4;
    glPositionBuffer.numItems = Math.floor(tmpPositionArray.length / 4);

    var glIntensityBuffer = webGLContext.createBuffer();
    webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, glIntensityBuffer);
    webGLContext.bufferData(webGLContext.ARRAY_BUFFER, new Float32Array(tmpIntensityArray), webGLContext.STATIC_DRAW);
    glIntensityBuffer.itemSize = 1;
    glIntensityBuffer.numItems = tmpIntensityArray.length;

    this.draw = function (projectionMatrix, modelViewMatrix) {
        webGLContext.useProgram(shaderProgram);

        // Set attributes
        webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, glPositionBuffer);
        webGLContext.vertexAttribPointer(
                webGLContext.getAttribLocation(shaderProgram, "aStar"),
                glPositionBuffer.itemSize, webGLContext.FLOAT, false, 0, 0
                );
        webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, glIntensityBuffer);
        webGLContext.vertexAttribPointer(
                webGLContext.getAttribLocation(shaderProgram, "aIntensity"),
                glIntensityBuffer.itemSize, webGLContext.FLOAT, false, 0, 0
                );

        // Set uniforms
        webGLContext.uniformMatrix4fv(webGLContext.getUniformLocation(shaderProgram, "uPMatrix"), false, projectionMatrix);
        webGLContext.uniformMatrix4fv(webGLContext.getUniformLocation(shaderProgram, "uMVMatrix"), false, modelViewMatrix);

        // Draw points
        webGLContext.drawArrays(webGLContext.POINTS, 0, glPositionBuffer.numItems);
    }
}
