function rational_pendulum() {

    var canvas = document.getElementById("rational-pendulum");
    var context = canvas.getContext("2d");

    function ddotmu(mu, dotmu) { return 2*dotmu*dotmu*mu/(1+mu*mu) - mu }
    function rk4(dt, mu, dotmu) {
	var
	    a = [ dotmu         , ddotmu(mu         , dotmu        ) ].map(x => dt * x),
	    b = [ dotmu + a[1]/2, ddotmu(mu + a[0]/2, dotmu + a[1]/2)].map(x => dt * x),
	    c = [ dotmu + b[1]/2, ddotmu(mu + b[0]/2, dotmu + b[1]/2)].map(x => dt * x),
	    d = [ dotmu + c[1]  , ddotmu(mu + c[0]  , dotmu + c[1]  )].map(x => dt * x);
	return [
	    (a[0] + 2*b[0] + 2*c[0] + d[0])/6,
	    (a[1] + 2*b[1] + 2*c[1] + d[1])/6
	];
    }
    var fps = 0.0;

    function draw(mu) {
	var
	    mu2 = mu*mu,
	    s = 1 - mu2,
	    q = 1 + mu*mu,
		x = s/q,
		y = 2*mu/q;
	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = "grey";
	context.fillRect(0, 0, fps, 20);
	context.fillText(fps.toPrecision(3) + " FPS", 100, 20);
	context.translate(canvas.width/2, 10);
	context.scale(20, 20);

	context.beginPath();
	context.strokeStyle = "green";
	context.moveTo(0, 0);
	context.lineTo(10*y, 10*x);
	context.stroke();
	context.beginPath();
	context.strokeStyle = "red";
	context.arc(10*y, 10*x, 2, 0, Math.PI*2);
	context.stroke();
	context.restore();
    }

    var
	mu = 1/Math.sqrt(3),
	dotmu = 0,
	then = Date.now()/1000;

    draw(mu);

    (function animate() {
	var now = Date.now()/1000;
	var dt = now - then;
	fps = 1/dt;
	var diff = rk4(dt, mu, dotmu);
	then = now;
	draw(mu);
	mu += diff[0];
	dotmu += diff[1];
	window.requestAnimationFrame(animate);
    })();
	
}

