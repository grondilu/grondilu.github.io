function rational_pendulum() {

    var canvas = document.getElementById("rational-pendulum");
    var context = canvas.getContext("2d");

    function rk4(dt, tau, dottau, ddottau) {
        var
            a = [ (dottau         )*dt, ddottau(tau         , dottau         )*dt],
            b = [ (dottau + a[1]/2)*dt, ddottau(tau + a[0]/2, dottau + a[1]/2)*dt],
            c = [ (dottau + b[1]/2)*dt, ddottau(tau + b[0]/2, dottau + b[1]/2)*dt],
            d = [ (dottau + c[1]  )*dt, ddottau(tau + c[0]  , dottau + c[1]  )*dt];
        return [
            (a[0] + 2*b[0] + 2*c[0] + d[0])/6,
            (a[1] + 2*b[1] + 2*c[1] + d[1])/6
        ];
    }
    var fps = 60, average_fps = fps;
    var fps_sum = 60, count = 1;

    function draw(x, y) {
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
        orientation = +1.0,
        mu = 1/Math.sqrt(3),
        dotmu = 0,
        then = Date.now()/1000;

    function M(mu) {
        var mu2 = mu*mu, s = 1 - mu2, q = 1 + mu2;
        return [orientation*s/q, orientation*2*mu/q];
    }
    function ddotmu(mu, dotmu) { return 2*dotmu*dotmu*mu/(1+mu*mu) - orientation*mu };

    (function animate() {
        var now = Date.now()/1000;
        var dt = Math.min(0.1, now - then);
        fps = 1/dt;
        var diff = rk4(dt, mu, dotmu, ddotmu);
        then = now;
        draw(...M(mu));
        mu += diff[0];
        dotmu += diff[1];
        var mu2 = mu*mu;
        if (mu2 > 1) {
            orientation *= -1.0;
            mu = -1/mu;
            dotmu /= mu2;
        }
        window.requestAnimationFrame(animate);
    })();
        
}

