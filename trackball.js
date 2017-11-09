class Trackball {
    get matrix() { return this._matrix; }
    get maxLength() { return Math.max(canvas.width, canvas.height); }
    constructor(canvas) {
        this.drag = false;
        this._matrix = mat4.create();
        this._matrix.copy = mat4.create();
        canvas.addEventListener("mousedown",
            e => {
                mat4.copy(this.matrix.copy, this.matrix);
                this.drag = true,
                    this.x = e.pageX,
                    this.y = e.pageY;
                e.preventDefault();
                return false;
            }, false
        );
        document.addEventListener("mouseup", e => this.drag = false);
        document.addEventListener("mousemove",
            e => {
                if (!this.drag) return false;
                mat4.multiply(
                    this.matrix,
                    this.turn(
                        -(e.pageX-this.x)/this.maxLength,
                        +(e.pageY-this.y)/this.maxLength
                    ),
                    this.matrix.copy
                );
                e.preventDefault();
            }, false
        );
    }
    turn(X, Y) {
        let X2 = X*X, Y2 = Y*Y,
            q  = 1 + X2 + Y2,
            s  = 1 - X2 - Y2,
            r2 = 1/(q*q), s2 = s*s,
            A  = (s2 + 4*(Y2 - X2))*r2, B = -8*X*Y*r2, C = 4*s*X*r2,
            D  = (s2 + 4*(X2 - Y2))*r2, E = 4*s*Y*r2,
            F  = (s2 - 4*(X2 + Y2))*r2;
        return [
             A, B, C, 0,
             B, D, E, 0,
            -C,-E, F, 0,
             0, 0, 0, 1
        ];
    }
}
