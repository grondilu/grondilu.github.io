var shaders =
[
{
    use : function () {
	gl.useProgram(this.program);
        this.program.vertexPositionAttribute = gl.getAttribLocation(this.program, "aVertexPosition");
        gl.enableVertexAttribArray(this.program.vertexPositionAttribute);

        this.program.textureCoordAttribute = gl.getAttribLocation(this.program, "aTextureCoord");
        gl.enableVertexAttribArray(this.program.textureCoordAttribute);

        this.program.pMatrixUniform = gl.getUniformLocation(this.program, "uPMatrix");
        this.program.mvMatrixUniform = gl.getUniformLocation(this.program, "uMVMatrix");
        this.program.samplerUniform = gl.getUniformLocation(this.program, "uSampler");
    },
    vertex :
    {
	src :
	    [
	    "attribute vec3 aVertexPosition;",
	    "attribute vec2 aTextureCoord;",

	    "uniform mat4 uMVMatrix;",
	    "uniform mat4 uPMatrix;",

	    "varying vec2 vTextureCoord;",

	    "void main(void) {",
	    "    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
	    "    vTextureCoord = aTextureCoord;",
	    "}"
	    ].join("\n")
    },
    fragment : {
	src:
	    [
	    "precision mediump float;",

	    "varying vec2 vTextureCoord;",

	    "uniform sampler2D uSampler;",

	    "void main(void) {",
	    "     vec4 color = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));",
	    "     gl_FragColor = vec4(color.r, color.g, color.b, 1.0);",
	    "}",
	    ].join("\n")
    }
}
];
