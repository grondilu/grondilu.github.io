/*
 * Copyright (c) 2018 Lucien Grondin <grondilu@yahoo.fr>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */
"use strict";

class Rat {
  static fromNumber(number) {
    const N = 6;
    if (typeof(number) == 'number') return new Rat(Math.round(number*10**N), 10**N);
    else throw new Error('argument must be a number');
  }
  constructor(num, den = 1) {
    let numerator = BigInt(num),
      denominator = BigInt(den),
      gcd = (
        function BigIntGCD(a, b) { return BigInt(b ? BigIntGCD(b, a % b) : (a > 0 ? a : -a)); }
    )(numerator, denominator);
    this.numerator = numerator/gcd;
    this.denominator = denominator/gcd;
  }
  add(that) { return new Rat(this.numerator*that.denominator + that.numerator*this.denominator, this.denominator*that.denominator); }
  subtract(that) { return this.add(that.opposite); }
  multiply(that) { return new Rat(this.numerator*that.numerator, this.denominator*that.denominator); }
  divide(that) { return new Rat(this.numerator*that.denominator, this.denominator*that.numerator); }
  toString() { return this.denominator == 1 ? this.numerator.toString() : this.numerator+"/"+this.denominator; }
  toTeX() { return this.denominator == 1 ? this.numerator.toString() : "\\frac{" + this.numerator + "}{" + this.denominator + "}"; }
  isOne() { return this.numerator == this.denominator; }
  isZero() { return this.numerator == 0; }
  get opposite() { return new Rat(-this.numerator, this.denominator); }
  static get zero() { return new Rat(0); }
  static get one() { return new Rat(1); }
}
function permutationSign(...p) {
  // permutation sign for a list of integers
  let n = p.length, sgn = 1;
  for(let i=0; i<n; ++i)
    for(let j=0; j<i; ++j) {
      if(p[i] < p[j]) sgn *= -1
      else if(p[i] === p[j]) return 0
    }
  return sgn
}
function grade(b) { let n = 0; while (b > 0) { if (b&1n) n++; b >>= 1n; } return n; }
function sign(a, b) {
  // sign of the product of two bit-Encoded blades
  let n = a >> 1n, sum = 0; while (n > 0) { sum += grade(n & b); n >>= 1n; }
  return sum & 1 ? -1 : 1;
}

class BasisVector {
  constructor (index, square = 1) {
    if (index === undefined) throw new Error("undefined index");
    else if (!Number.isInteger(index)) throw new Error("index must be an integer");
    else if (index < 0) throw new Error("negative index");
    else if (square*square !== 1) throw new Error("non-unitary square");
    else {
      this.square = square;
      this.index  = index;
    }
  }
  bitEncoding()     { throw new Error("Virtual call"); }
  toString() { return this.letter + this.index; }
  toTeX() { return "\\mathbf{" + this.letter + "}_" + this.index; }
  get letter() { return this.square === 1 ? 'e' : '\\bar e'; }
  get order() { throw "virtual method call"; }
  static fromOrder(order) {
    return order >= 2 ?
      new AntiEuclideanBasisVector(order - 2) :
      new EuclideanBasisVector(Math.floor(1/(1 - order) - 2));
  }
}
class EuclideanBasisVector extends BasisVector {
  constructor (index) { super(index, 1); }
  get bitEncoding() { return 1n << BigInt(2*this.index); }
  get order() { return 1 - 1/(2 + this.index) }
}
class AntiEuclideanBasisVector extends BasisVector {
  constructor (index) { super(index, -1); }
  toString() { return 'ē' + this.index; }
  get bitEncoding() { return 1n << BigInt(2*this.index + 1); }
  get order() { return 2 + this.index; }
}

// Some constants related to the Minkowski plane
const eplane   = 0b11;
const eplus    = 0b01;
const eminus   = 0b10;

const oriinf   = 0b11;
const origin   = 0b01;
const infinity = 0b10;

class BasisBlade {
  // has basisVectors;
  // has Polynomial scale;
  static get zero() { return new BasisBlade([], Polynomial.zero); }
  static get one() { return new BasisBlade([], Polynomial.one); }
  constructor(...args) {
    if (args.every(x => x instanceof BasisVector)) {
      this.basisVectors = args;
      this.scale = new Polynomial(new Rat(permutationSign(...this.basisVectors.map(x => x.order))));
    }
    else if (args.length == 0) { this.basisVectors = []; this.scale = Polynomial.one; }
    else if (args.length == 1) {
      let arg = args[0];
      if (arg instanceof Polynomial) {
        this.basisVectors = []; this.scale = arg;
      } else if (arg instanceof Array) {
        if (arg.every(x => x instanceof BasisVector)) {
          this.basisVectors = args;
          this.scale = new Polynomial(new Rat(permutationSign(...this.basisVectors)));
        } else throw new Error("an array of basis vectors was expected");
      } else if (typeof(arg) == 'bigint') {
        throw "NYI";
      } else if (typeof(arg) == 'string') {
        let re = /^[eē](0|[1-9][0-9]*)$/;
        if (re.test(arg)) {
          console.log(arg.match(re));
        }
        throw "NYI";
      } else throw new Error("unsupported constructor argument of type " + arg.constructor.name);
    }
    else if (args.length == 2) {
      let arg0 = args[0], arg1 = args[1];
      if (arg0 instanceof Array && arg1 instanceof Polynomial) {
        this.basisVectors = arg0;
        this.scale = arg1;
      } else throw new Error("invalid two-arguments");
    } else throw new Error("could not parse arguments");
  }
  toString() {
    if (this.grade == 0) return this.scale.toString();
    return this.basisVectors.length === 0 ? '1' :
      this.basisVectors
    .sort((a,b) => a.order > b.order)
    .map(x => x.toString())
    .join('∧');
  }
  toTeX() {
    if (this.basisVectors.length == 0) { return this.scale.toTeX(); }
    else {
      let scale = this.scale.toTeX();
      return (
        this.scale.degree > 0 ? `(${scale})` :
          this.scale.isOne() ? '' :
          this.scale.negate().isOne() ? '-' :
          scale
      ) +
      this.basisVectors.
        sort((a,b) => a.order > b.order).
        map(x => x.toTeX()).
        join('\\wedge ');
    }
  }
  wedge(that) {
    if (that instanceof BasisBlade) {
      if (this.bitEncoding & that.bitEncoding) return BasisBlade.zero;
      else return this.multiply(that);
    } else throw new Error("unsupported argument type");
  }
  multiply(that) {
    if (that instanceof BasisBlade) {
      let basisVectors = [],
        scale = this.scale.multiply(that.scale),
        $sign = sign(this.bitEncoding, that.bitEncoding);
      for (
        let n = 1, bitEncoding = this.bitEncoding & that.bitEncoding;
        bitEncoding > 0;
        n *= -1, bitEncoding >>= 1n
      ) { if (bitEncoding & 1n) $sign *= n; }
      for (
        let n = 0, bitEncoding = this.bitEncoding ^ that.bitEncoding;
        bitEncoding > 0;
        n++, bitEncoding >>= 1n
      ) {
        if (bitEncoding & 1n) 
          basisVectors.push(
            new (n % 2 ? AntiEuclideanBasisVector : EuclideanBasisVector)(
              parseInt(n % 2 ? (n-1)/2 : n/2)
            )
          );
      }
      return new BasisBlade(basisVectors, scale.multiply(new Polynomial(new Rat($sign))));
    } else if (that instanceof Rat) {
      throw "NYI";
    } else throw new Error("unsupported argument type");
  }
  divide(that) {
    if (that instanceof Rat) {
      return new BasisBlade(this.basisVectors, this.scale.divide(that));
    } else throw new Error("only Rat division supported");
  }
  negate() { return new BasisBlade(this.basisVectors, this.scale.negate()); }
  get grade() { return this.basisVectors.length; }
  isZero() { return this.scale.isZero(); }
  get bitEncoding() {
    return this.basisVectors.
      map(x => x.bitEncoding).
      reduce((a,b) => a|b, 0n);
  }
}

class PoweredVariable {
  constructor(varname, power = 1) {
    if (!/^\w$/.test(varname))
      throw new Error("incorrect variable name " + variable);
    if (power < 1 || Math.floor(power) !== power)
      throw new Error("incorrect exponent " + power);
    this.varname = varname;
    this.power = power;
  }
  toString() { return this.varname + (this.power === 1 ? '' : '^'+this.power); }
  toTeX() { return this.toString(); }
  eval(dict) {
    if (this.varname in dict) {
      return Math.pow(dict[this.varname], this.power);
    } else throw "unknown variable " + this.varname;
  }
}

class Monomial {
  constructor(...poweredVars) {
    if (!poweredVars.every(x => x instanceof PoweredVariable))
      throw new Error("constructor accepts only powers of variables");
    if (new Set(poweredVars.map(x => x.varname)).size !== poweredVars.length)
      throw new Error("duplicated variable");
    this.poweredVars = poweredVars;
  }
  toString() {
    return this.poweredVars.
      sort((a, b) => a.varname > b.varname).
      map(x => x.toString()).
      join('*');
  }
  toTeX() {
    return this.poweredVars.
    sort((a, b) => a.varname > b.varname).
      map(x => x.toTeX()).
      join('');
  }
  eval(dict) {
    return this.poweredVars.
      map(x => x.eval(dict)).
      reduce((a, b) => a*b, 1)
  }
  get degree() {
    return this.poweredVars.
      map(x => x.power).
      reduce((a,b)=>a+b, 0);
  }
  multiply(that) {
    if (!(that instanceof Monomial))
      throw new Error("multiplicand is not a Monomial");
    let bag = {};
    for (let v of [...this.poweredVars, ...that.poweredVars]) {
      if (v.varname in bag) 
        bag[v.varname] += v.power;
      else bag[v.varname] = v.power;
    }
    return new Monomial(
      ...Object.keys(bag).map(name => new PoweredVariable(name, bag[name]))
    );
  }
}
class ScaledMonomial {
  constructor(monomial, scale = new Rat(1)) {
    if (!(monomial instanceof Monomial))
      throw new Error("first argument must be a monomial");
    if (!(scale instanceof Rat))
      throw new Error("scale must be an instance of Rat");
    this.scale = scale;
    this.monomial = monomial;
  }
  toString() {
    return (this.scale === +1 ? ''  :
            this.scale === -1 ? '-' :
            this.scale + '*') + this.monomial.toString();
  }
  toTeX() {
    if (this.degree == 0) return this.scale.toTeX();
    return (this.scale.isOne() ? '' :
       this.scale.opposite.isOne() ? '-' : this.scale.toTeX()
      ) + this.monomial.toTeX();
  }
  get degree() { return this.monomial.degree; }
  eval(dict = {}) { return new Rat(this.scale * this.monomial.eval(dict)); }
  multiply(that) {
    if (!(that instanceof ScaledMonomial))
      throw new Error("multiplicand is not a second class monomial");
    return new ScaledMonomial(
      this.monomial.multiply(that.monomial),
      this.scale.multiply(that.scale)
    );
  }
  negate() { return new ScaledMonomial(this.monomial, this.scale.opposite); }
  isZero() { return this.scale.isZero(); }
  isOne() { return this.scale.isOne(); }
}
class Polynomial {
  static get zero() { return new Polynomial(Rat.zero); }
  static get one() { return new Polynomial(Rat.one); }
  constructor(...args) {
    if (args.length === 1) {
      let arg = args[0];
      if (typeof(arg) == 'bigint') { return new Polynomial(new Rat(arg)); }
      else if (arg instanceof Rat) {
        this.monomials = [
          new ScaledMonomial(new Monomial(), arg)
        ];
      } else if (arg instanceof Monomial) {
        this.monomials = [ new ScaledMonomial(arg) ];
      } else if (arg instanceof ScaledMonomial) {
        this.monomials = [ arg ];
      } else throw new Error("unexpected argument type");
    } else if (args.every(x => x instanceof ScaledMonomial)) {
      if (
        new Set(
          args.map(x => x.monomial.toString())
        ).size !== args.length
      ) throw new Error("duplicated monomial");
      this.monomials = args;
    } else throw new Error("constructor only accepts second class monomial arguments");
  }
  eval(dict = {}) {
    return this.monomials.map(x => x.eval(dict)).reduce(
      (a,b) => a+b, 0
    );
  }
  subtract(that) { return this.add(that.negate); }
  add(that) {
    let scales = {}
    for (let scaledMonomial of this.monomials.concat(that.monomials)) {
      let monomial = scaledMonomial.monomial,
        scale = scaledMonomial.scale,
        key = monomial.toString();
      if (scales[key] === undefined) {
        scales[key] = { monomial, scale };
      } else {
        scales[key].scale = scales[key].scale.add(scale);
      }
    }
    let scaledMonomials = Object.values(scales).
        filter(x => !x.scale.isZero()).
      map(o => new ScaledMonomial(o.monomial, o.scale));
    if (scaledMonomials.length == 0) return Polynomial.zero;
    else return new Polynomial(...scaledMonomials);
  }
  multiply(that) {
    if (that instanceof Polynomial) {
      return [...(function* (monomials) {
        for (let i of monomials) for (let j of that.monomials)
          yield new Polynomial(i.multiply(j))
      })(this.monomials)].reduce((a,b) => a.add(b), Polynomial.zero);
    } else throw new Error("multiplicand is not a polynomial");
  }
  negate() { return new Polynomial(...this.monomials.map(m => m.negate())) ; }
  divide(that) {
    if (that instanceof Polynomial) {
      if (that.degree > 0) throw new Error("rational fractions NYI");
      return this.divide(that.monomials[0].scale);
    } else if (that instanceof Rat) {
      return new Polynomial(
        ...this.monomials.map(m => new ScaledMonomial(m.monomial, m.scale.divide(that)))
      );
    }
  }
  get degree() { return Math.max(...this.monomials.map(x => x.degree)); }
  toString() {
    return this.monomials.
      map(m => m.toString()).
      join('+').
      replace(/\+-/g, '-');
  }
  toTeX() {
    return this.monomials.
    map(m => m.toTeX()).
    join('+').
    replace(/\+-/g, '-');
  }
  isZero() { return this.degree == 0 && this.monomials[0].isZero(); }
  isOne () { return this.degree == 0 && this.monomials[0].isOne(); }
}

class MultiVector {
  static get zero() { return new MultiVector(BasisBlade.zero); }
  static get one() { return new MultiVector(BasisBlade.one); }
  static fromParseTree(node) {
    if (Number.isInteger(node)) return node;
    if(typeof(node) !== "object") throw new Error("unexpected argument type");
    switch(node.type) {
      case "number":
        return new MultiVector(
          new BasisBlade(new Polynomial(new Rat(node.args[0])))
      );
      case "basis vector":
        return (
          (square, index) => new MultiVector(
            new BasisBlade(
              new (square > 0 ? EuclideanBasisVector : AntiEuclideanBasisVector)(index)
            )
          )
      )(node.args[0], parseInt(node.args[1]));
      case "variable":
        return new MultiVector(
          new BasisBlade(
            new Polynomial(
              new ScaledMonomial(
                new Monomial(
                  new PoweredVariable(node.args[0])
                )
              )
            )
          )
      );
      case "operator":
        return node.op(...node.args.map(MultiVector.fromParseTree));
      default:
        throw new Error(node.type + " NYI");
    }
  }
  constructor(...args) {
    if (args.every(x => x instanceof BasisBlade)) {
      if (new Set(args.map(x => x.toString())).size !== args.length)
        throw new Error("duplicated blade");
      this.blades = args;
    } else if (args.length === 1) {
      let arg = args[0];
      if (arg instanceof BasisBlade || arg instanceof Polynomial) {
        this.blades = [ new BasisBlade(arg) ];
      } else if (typeof(arg) == 'object') {
        let mv = MultiVector.fromParseTree(arg);
        this.blades = mv.blades;
      } else throw new Error("unexpected constructor argument of type " + arg.constructor.name);
    } else throw new Error("unexpected constructor call");
  }
  toTeX() { return this.blades.map(x => x.toTeX()).join("+"); }
  toString() { return this.blades.map(x => x.toString()).join('+'); }
  get grade() { return Math.max(...this.blades.map(x => x.grade)); }
  add(that) {
    if (that instanceof MultiVector) {
      let blades = {};
      for (let blade of this.blades.concat(that.blades)) {
        let key = blade.bitEncoding;
        if (blades[key] === undefined) {
          blades[key] = new BasisBlade(blade.basisVectors, blade.scale);
        } else {
          blades[key].scale = blades[key].scale.add(blade.scale);
        }
      }
      blades = Object.values(blades).filter(x => !x.scale.isZero());
      if (blades.length == 0) return MultiVector.zero;
      else return new MultiVector(...blades);
    } else throw new Error("unexpected argument of type " + that.constructor.name);
  }
  multiply(that) {
    if (that instanceof MultiVector) {
      return [...(function* (blades) { for (let i of blades) for (let j of that.blades) {
        yield new MultiVector(i.multiply(j));
      }
      })(this.blades)].reduce((a,b) => a.add(b), MultiVector.zero)
    } else throw new Error("unsupported argument type");
  }
  divide(that) {
    if (that instanceof MultiVector) {
      if (that.grade == 0) {
        let polynomial = that.blades[0].scale;
        if (polynomial.degree == 0) {
          let rat = polynomial.monomials[0].scale;
          return new MultiVector(
            ...this.blades.map(b => b.divide(rat))
          );
        } else throw new Error("can't divide by true Polynomial");
      } else throw new Error("can't divide by true MultiVector");
    }
  }
  negate() { return new MultiVector(...this.blades.map(m => m.negate())); }
  subtract(that) { return this.add(that.negate()); }
}

