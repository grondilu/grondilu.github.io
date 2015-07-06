function Hud(canvas) {
    this.context = canvas.getContext("2d");
    this.scanner = {
	center : [ 0, -180 ],
	scale : 256,
	width : 288,
	height : 72,
	max_zoom : 5.0,
	zoom_levels : 5,
	zoom_indictor_center : [ 108, -216 ],
    };
    this.compass = {
	center : [ 132, -216 ],
	size : 32,
	half_size : 16,
	dot : {
	    position : vec2.create(),
	    size : 8,
	    half_size : 4,
	    fillOrStroke : "stroke",
	    setFrom3D : function (x, y, z) {
		vec2.set(this.position, x, y);
		var n = Math.sqrt(x*x + y*y);
		var angle = Math.atan( n / z );
		if (n > 0) {
		    vec2.scale(
			    this.position,
			    this.position,
			    Math.abs(angle) / ( n * Math.PI / 2 )
			    * 16
			    );
		}
		this.fillOrStroke = z < 0 ? "fill" : "stroke";
	    }
	}
    };
    this.attitudeBars = {
	width : 100,
	height : 10
    };
};



