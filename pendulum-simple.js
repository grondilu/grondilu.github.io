function simple_pendulum() {
    var canvas = document.getElementById("simple-pendulum");
    var context = canvas.getContext("2d");
    function rk4(dt, theta, dottheta) {
	var
	    a = [dottheta         , -Math.sin(theta         )].map(x => x * dt),
	    b = [dottheta + a[1]/2, -Math.sin(theta + a[0]/2)].map(x => x * dt),
	    c = [dottheta + b[1]/2, -Math.sin(theta + b[0]/2)].map(x => x * dt),
	    d = [dottheta + c[1]  , -Math.sin(theta + b[0]  )].map(x => x * dt);
	return [
	    (a[0] + 2*b[0] + 2*c[0] + d[0])/6,
	    (a[1] + 2*b[1] + 2*c[1] + d[1])/6
	];
    }

    var fps = 60, average_fps = fps;
    var fps_sum = 60, count = 1;

    function draw(theta) {
	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = "grey";
	context.fillText(
		fps.toPrecision(3) +
		" FPS (average " +
		(
		 fps > 1000 ?
		 average_fps :
		 (average_fps = (fps_sum += Math.min(fps, 120))/++count)
		).toPrecision(3) + ")",
		0, 20
	);
	context.translate(canvas.width/2, 10);
	context.rotate(theta);
	context.scale(20, 20);
	context.beginPath();
	context.strokeStyle = "green";
	context.moveTo(0, 0);
	context.lineTo(0, 10);
	context.stroke();
	context.beginPath();
	context.strokeStyle = "red";
	context.arc(0, 10, 2, 0, Math.PI*2);
	context.stroke();
	context.restore();
    }

    var theta = -Math.PI/3, dottheta = 0, then = Date.now()/1000;
    draw(theta);

    (function animate() {
	var now = Date.now()/1000;
	var dt = Math.min(0.1, now - then);
	fps = 1/dt;
	var diff = rk4(dt, theta, dottheta);
	then = now;
	draw(theta);
	theta += diff[0];
	dottheta += diff[1];
	window.requestAnimationFrame(animate);
    })();
	
}
