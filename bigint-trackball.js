function gcd(a, b) {
      return BigInt(b ? gcd(b, a % b) : Math.abs(new Number(a)));
}
class Trackball {
    simplify() {
        let GCD = [ this.denominator, ...this.submatrix ].reduce(gcd);
        this.submatrix = this.submatrix.map( x => x / GCD );
        this.denominator /= GCD;
    }
    get matrix() {
        let M = this.submatrix.map(
                x => new Number(x)/new Number(this.denominator)
            );
        return [
            M[0], M[1], M[2], 0,
            M[3], M[4], M[5], 0,
            M[6], M[7], M[8], 0,
               0,    0,    0, 1
        ];
    }
    copy() {
        this.simplify();
        this.submatrix_copy = this.submatrix.slice();
        this.denominator_copy = this.denominator;
    }
    constructor(canvas) {
        this.drag = false;
        this.canvas = canvas;
        this.submatrix = [1n, 0n, 0n, 0n, 1n, 0n, 0n, 0n, 1n];
        this.submatrix_copy = [1n, 0n, 0n, 0n, 1n, 0n, 0n, 0n, 1n];
        this.denominator = 1n;
        this.denominator_copy = 1n;
        this.maxLength = Math.max(this.canvas.width, this.canvas.height);
        canvas.addEventListener(
            "mousedown", e => {
                this.copy();
                this.drag = true;
                this.x = e.pageX;
                this.y = e.pageY;
                e.preventDefault();
                return false;
            }, false
        );
        document.addEventListener(
            "mouseup", e => {
                this.drag = false;
                this.simplify();
            }
        );
        document.addEventListener(
            "mousemove", e => {
                if (!this.drag) return false;
                let X = -BigInt(e.pageX-this.x),
                    Y = BigInt(e.pageY-this.y),
                    Z = BigInt(this.maxLength),
                    X2 = X*X, Y2 = Y*Y, Z2 = Z*Z,
                    Z3 = Z2*Z,
                    A = Z2*(Z2-X2-Y2),
                    Q2 = Z2*(Z2+X2+Y2),
                    Q4 = Q2*Q2,
                    B = 2n*Z3*X,
                    C = 2n*Z3*Y,
                    A2 = A*A, B2 = B*B, C2 = C*C,
                    AB = A*B, BC = B*C, AC = A*C;
                mat3.multiply(
                    this.submatrix,
                    [
                        A2-B2+C2, -2n*BC   , 2n*AB,
                        -2n*BC   , A2+B2-C2, 2n*AC,
                        -2n*AB   , -2n*AC  , A2-B2-C2
                    ],
                    this.submatrix_copy
                );
                this.denominator = this.denominator_copy*Q4;
                e.preventDefault();
            }, false
        );
    }
}
