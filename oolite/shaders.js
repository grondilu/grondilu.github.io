function compileShader(gl, src) {
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
