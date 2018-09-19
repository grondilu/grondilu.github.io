function translate(object) {
  if(typeof(object) !== "object") throw new Error("unexpected argument type");
  switch(object.type) {
    case "number":
      return new MultiVector(
        new Blade(new Polynomial(new Rat(object.args[0])))
      );
    case "basis vector":
      return new MultiVector(
        new Blade(
          new (object.args[0] == 1 ? EuclideanBasisVector : AntiEuclideanBasisVector)(
            parseInt(object.args[1])
          )
        )
      );
    case "addition":
      return object.args.map(translate).reduce((a,b) => a.add(b));
    case "subtraction":
      return object.args.map(translate).reduce((a,b) => a.subtract(b));
    case "multiplication":
      return object.args.map(translate).reduce((a,b) => a.multiply(b));
    case "division":
      return object.args.map(translate).reduce((a,b) => a.divide(b));
    case "variable":
      return new MultiVector(
        new Blade(
          new Polynomial(
            new ScaledMonomial(
              new Monomial(
                new PoweredVariable(object.args[0])
              )
            )
          )
        )
      );
    case "exponentiation":
      return (function exponentiate(b, n) {
        return n == 0 ? translate({ type: "number", args: [ 1 ]}) :
          n == 1 ? b :
          (x => n % 2 == 0 ? x : x.multiply(b))(
            (x => x.multiply(x))(exponentiate(b, Math.floor(n/2)))
          );
      })(translate(object.args[0]), object.args[1]);
    default:
      throw new Error(object.type + " NYI");
  }
}
