class Trackball {
  get matrix() { return mat4.multiply(mat4.create(), this.translation, this.rotation); }
  get maxLength() { return Math.max(this.canvas.width, this.canvas.height); }
  constructor(canvas, distance = 10) {
    this.canvas = canvas;
    this.drag = false;
    this.rotation = mat4.create();
    this.translation = mat4.create();
    this.translation[14] = -10;
    mat4.copy(this.rotation.copy = mat4.create(), this.rotation);
    canvas.addEventListener("wheel",
      (function (self) {
        return function (e) {
          self.translation[14] *= e.deltaY > 0 ? 1.1 : 0.9;
          e.preventDefault()
        }
      })(this)
    );
    canvas.addEventListener("mousedown",
      e => {
        mat4.copy(this.rotation.copy, this.rotation);
        this.drag = true;
        this.x = e.pageX;
        this.y = e.pageY;
        e.preventDefault();
        return false;
      }, false
    );
    canvas.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();
        if (e.touches.length == 1) {
          let t = e.touches[0];
          mat4.copy(this.rotation.copy, this.rotation);
          this.drag = true;
          this.x = t.pageX;
          this.y = t.pageY;
        } else {
        }
      }
    );
    document.addEventListener("mouseup", e => this.drag = false);
    document.addEventListener("touchend",
      e => {
        this.drag = false;
      }
    );
    document.addEventListener("mousemove",
      e => {
        if (!this.drag) return false;
        mat4.multiply(
          this.rotation,
          this.turn(
            -(e.pageX-this.x)/this.maxLength,
            +(e.pageY-this.y)/this.maxLength,
          ),
          this.rotation.copy,
        );
        e.preventDefault();
      }, false
    );
    document.addEventListener("touchmove",
      e => {
        e.preventDefault();
        if (e.touches.length == 1) {
          if (!this.drag) return false;
          let t = e.touches[0];
          mat4.multiply(
            this.rotation,
            this.turn(
              -(t.pageX-this.x)/this.maxLength,
              +(t.pageY-this.y)/this.maxLength,
            ),
            this.rotation.copy,
          );
        } else { ; }
      }
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
