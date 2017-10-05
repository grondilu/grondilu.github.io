function get_projection(angle, a, zMin, zMax) {
    let ang = Math.tan((angle*.5)*Math.PI/180);//angle*.5
    return mat4.fromValues(
        0.5/ang, 0 , 0, 0,
        0, 0.5*a/ang, 0, 0,
        0, 0, -(zMax+zMin)/(zMax-zMin), -1,
        0, 0, (-2*zMax*zMin)/(zMax-zMin), 0 
    );
}

let mo_matrix   = mat4.create();

mo_matrix.copy = mat4.create();

function turn(X, Y) {
    let X2 = X*X, Y2 = Y*Y,
        q  = 1 + X2 + Y2,
        s  = 1 - X2 - Y2,
        r2 = 1/(q*q), s2 = s*s,
        A  = (s2 + 4*(Y2 - X2))*r2, B = -8*X*Y*r2, C = 4*s*X*r2,
        D  = (s2 + 4*(X2 - Y2))*r2, E = 4*s*Y*r2,
        F  = (s2 - 4*(X2 + Y2))*r2;
    mat4.multiply(
        mo_matrix, [
            A, B, C, 0,
            B, D, E, 0,
            -C,-E, F, 0,
            0, 0, 0, 1
        ], mo_matrix.copy
    );
}

{
        // MOUSE MANAGEMENT
        let drag = false, old_x, old_y;

        document.addEventListener("mousedown",
            function (e) {
                mat4.copy(mo_matrix.copy, mo_matrix);
                document.body.style.transform =
                    "matrix3d(" + mo_matrix.copy.join(",") + ")";
                drag = true, old_x = e.pageX, old_y = e.pageY;
                e.preventDefault();
                return false;
            }, false
        );
        document.addEventListener("mouseup", function (e) { drag = false; });
        document.addEventListener("mousemove",
            function(e) {
                if (!drag) return false;
                turn(
                    -(e.pageX-old_x)/1080,
                    +(e.pageY-old_y)/1920
                );
                document.body.style.transform =
                    "matrix3d(" + mo_matrix.join(",") + ")";
                e.preventDefault();
            }, false
        );
    }
