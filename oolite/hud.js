function Hud(canvas, ship, scene) {
    var context = canvas.getContext("2d");
    context.scale(canvas.width / 100, canvas.height / 100);
    this.context = context;
    this.ship = ship;
    this.scene = scene;
    this.compass = new Compass(context, function() { return ship.target });
    this.pitchIndicator = new AngularRateIndicator(context, function () { return ship.pitch });
    this.rollIndicator  = new AngularRateIndicator(context, function () { return ship.roll });
    this.speedIndicator = new Gauge(context, function() {return ship.speed;}, 200);
    this.draw = function (tx, ty, sx, sy) {
	context.save();
	context.clearRect(0, 0, 100, 100);
	context.strokeStyle = "green";
	context.fillStyle = "green";
	if ( tx || ty ) { context.translate(tx, ty); }
	if ( sx || sy ) { context.scale(sx, sy); }
	this.rollIndicator.draw( 75, 75,     0.25, 0.25);
	this.pitchIndicator.draw(75, 75 + 3, 0.25, 0.25);
	this.speedIndicator.draw(75, 75 + 6, 0.25, 0.25);
	//this.compass.draw((100 + 75)/2, (100 + 75 + 9)/2, 0.25, 0.25);
	this.compass.draw(75, 75 + 12, 0.1, 0.1);
	context.restore();
    }
}

function Gauge(context, value, max) {
    this.draw = function (tx, ty, sx, sy) {
	context.save();
	if ( tx || ty ) { context.translate(tx, ty); }
	if ( sx || sy ) { context.scale(sx, sy); }
	var length = value() / max * 100;
	length = Math.max(0, length);
	length = Math.min(100, length);
	context.strokeRect(0, 0, 100, 10);
	context.fillStyle = "DarkGreen";
	context.fillRect(0, 0, length, 10);
	context.restore();
    }
}
function Compass(context, target) {
    var dotsize = 10;
    this.draw = function (tx, ty, sx, sy) {
	var xyz = target();
	var x = xyz[0], y = xyz[1], z = xyz[2];
	var n = Math.sqrt(x*x + y*y);
	context.save();
	if ( tx || ty ) { context.translate(tx, ty); }
	if ( sx || sy ) { context.scale(sx, sy); }
	context.beginPath();
	context.arc(50, 50, 50, 0, 2*Math.PI);
	context.stroke();
	context.beginPath();
	if (n == 0) {
	    context.arc(50,50, dotsize, 0, 2*Math.PI);
	    if (z == 0) {
		context.fillStyle = "grey";
		context.fill();
		context.restore();
		return;
	    } 
       	} else {
	    var angle = Math.atan2(n, Math.abs(z));
	    if (angle == 0) { alert("unexpected angle value") }
	    x /= n; y /= n;
	    x *= angle / (Math.PI/2);
	    y *= angle / (Math.PI/2);
	    context.arc(50 +50*x, 50-50*y, dotsize, 0, 2*Math.PI);
	    // I don't understand why writing z > 0 here
	    // gives me the opposite result of what I want
	}
	z < 0 ? context.fill() : context.stroke();
	context.restore();
    }
}

function AngularRateIndicator(context, rate) {
    this.draw = function (x, y, sx, sy) {
	var r = 50 * rate() / Math.PI;
	r = Math.max(-50, r);
	r = Math.min(+50, r);
	context.save();
	if ( x || y ) { context.translate(x, y); }
	if ( sx || sy ) { context.scale(sx, sy); }
	context.fillStyle = "yellow";
	if (r > 0) {
	    context.fillRect(50, 0, r, 10);
	} else {
	    context.fillRect(50 + r, 0, -r, 10);
	}
	context.fillStyle = "green";
	context.fillRect(50 + (r > 0 ? -1 : 0), 0, 1, 10);
	context.strokeRect(0,0, 100, 10);
	context.restore();
    }
}
