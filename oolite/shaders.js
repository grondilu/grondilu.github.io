var shaders =
[
{
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
