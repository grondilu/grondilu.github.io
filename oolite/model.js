function Model(gl, data) {
    if (!data)                                      { console.log("no model data");                               return; }
    if (!data.vertices)                             { console.log("no vertex data");                              return; }
    if (data.vertices.length % 3 !== 0)             { console.log("unexpected vertex array length");              return; }
    if (data.faces.length % 3 !== 0)                { console.log("unexpected faces array length");               return; }
    if (data.normals.length % 3 !== 0)              { console.log("unexpected normals array length");             return; }
    if (data.texture.coordinates.length % 3 !== 0)  { console.log("unexpected texture coordinates array length"); return; }

    data.vertices.numItems = Math.floor(data.vertices.length / (data.vertices.itemSize = 3));
    gl.bindBuffer(gl.ARRAY_BUFFER, data.vertices.glBuffer = gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertices), gl.STATIC_DRAW);

    data.faces.numItems = Math.floor(data.faces.length / (data.faces.itemSize = 1));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, data.faces.glBuffer = gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.faces), gl.STATIC_DRAW);

    data.normals.numItems = Math.floor(data.normals.length / (data.normals.itemSize = 3));
    gl.bindBuffer(gl.ARRAY_BUFFER, data.normals.glBuffer = gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);

    data.texture.coordinates.numItems = Math.floor(data.texture.coordinates.length / (data.texture.coordinates.itemSize = 2));
    gl.bindBuffer(gl.ARRAY_BUFFER, data.texture.coordinates.glBuffer = gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texture.coordinates), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, data.texture.glTexture = gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));

    var image = new Image();
    image.src = "../images/textures/" + data.texture.images[0];
    data.texture.glTexture.image = image;
    gl.bindTexture(gl.TEXTURE_2D, data.texture.glTexture);
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(   gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data.texture.glTexture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(  gl.TEXTURE_2D, null);

    this.draw = function (pMatrix, mvMatrix) {
	gl.useProgram(this.shaderProgram);

	gl.enableVertexAttribArray(gl.getAttribLocation(this.shaderProgram, "aVertexPosition"));
	gl.bindBuffer(gl.ARRAY_BUFFER, data.vertices.glBuffer);
	gl.vertexAttribPointer(
		gl.getAttribLocation(this.shaderProgram, "aVertexPosition"),
		data.vertices.itemSize, gl.FLOAT, false, 0, 0
		);

	gl.enableVertexAttribArray(gl.getAttribLocation(this.shaderProgram, "aTextureCoord"));
	gl.bindBuffer(gl.ARRAY_BUFFER, data.texture.coordinates.glBuffer);
	gl.vertexAttribPointer(
		gl.getAttribLocation(this.shaderProgram, "aTextureCoord"),
		data.texture.coordinates.itemSize, gl.FLOAT, false, 0, 0
		);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, data.texture.glTexture);
	gl.uniform1i(gl.getUniformLocation(this.shaderProgram, "uSampler"), 0);

	gl.uniformMatrix4fv(gl.getUniformLocation(this.shaderProgram, "uPMatrix"), false, pMatrix);
	gl.uniformMatrix4fv(gl.getUniformLocation(this.shaderProgram, "uMVMatrix"), false, mvMatrix);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, data.faces.glBuffer);
	gl.drawElements(gl.TRIANGLES, data.faces.numItems, gl.UNSIGNED_SHORT, 0);
    }
}
