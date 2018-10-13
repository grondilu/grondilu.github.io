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

function grade(b) { let n = 0; while (b > 0) { if (b&1n) n++; b >>= 1n; } return n; }
function sign(a, b) {
  let n = a >> 1n, sum = 0; while (n > 0) { sum += grade(n & b); n >>= 1n; }
  return sum & 1 ? -1 : 1;
}

// Some constants related to the Minkowski plane
const eplane   = 0b11n;
const eplus    = 0b01n;
const eminus   = 0b10n;

const oriinf   = 0b11n;
const origin   = 0b01n;
const infinity = 0b10n;

class BasisBlade {
  static get zero() { return new BasisBlade(0n, Polynomial.zero); }
  static get one() { return new BasisBlade(0n, Polynomial.one); }
  constructor(bitEncoding, weight = Polynomial.one) {
    if (typeof(bitEncoding) !== 'bigint') throw new Error("bitEncoding must be a big integer");
    if (!(weight instanceof Polynomial)) throw new Error("weight must be a multivariate polynomial");
    this.bitEncoding = bitEncoding;
    this.weight = weight;
  }
  // "scale" is an alias for "weight"
  get scale() { return this.weight; }
  divide(that) {
    if (that instanceof Rat) {
      return new BasisBlade(this.bitEncoding, this.weight.divide(that));
    } else throw new Error("only Rat division supported");
  }
  negate() { return new BasisBlade(this.bitEncoding, this.weight.negate()); }
  get grade() { return grade(this.bitEncoding); }
  isZero() { return this.weight.isZero(); }
  toString() {
    if (this.grade == 0) return this.weight.toString();
    else return (
      this.weight.isOne() ? '' :
      this.weight.negate().isOne() ? '-' :
    this.weight.toString() + '*'
    ) + [...(function*(b) {
      let n = 0;
      if (b & origin) yield 'no';
      if (b & infinity) yield 'ni';
      b >>= 2n;
      while (b > 0) {
        n++;
        if (b & 1n) yield n % 2 ? `e${(n-1) / 2}` : `ē${n/2 - 1}`;
        b >>= 1n;
      }
    })(this.bitEncoding)].join('∧');
  }
  toTeX() {
    if (this.grade == 0) return this.weight.toTeX();
    else return (
      this.weight.isOne() ? '' :
      this.weight.negate().isOne() ? '-' :
    this.weight.toTeX()
    ) + [...(function*(b) {
      let n = 0;
      if (b & origin) yield 'n_o';
      if (b & infinity) yield 'n_{\\infty}';
      b >>= 2n;
      while (b > 0) {
        n++;
        if (b & 1n) yield n % 2 ? `e_${(n-1) / 2}` : `{\\bar e}_${n/2 - 1}`;
        b >>= 1n;
      }
    })(this.bitEncoding)].join('\\wedge ');
  }
  toDiagonalBasis() {
    if ([0b00n, oriinf].includes(this.bitEncoding & oriinf)) {
      return [new BasisBlade(this.bitEncoding, this.weight)];
    } else if (this.bitEncoding & origin) {
      let b = this.bitEncoding ^ origin,
        weight = this.weight.divide(new Rat(2));
      return [
        new BasisBlade(b ^ eplus, weight),
        new BasisBlade(b ^ eminus, weight)
      ];
    } else if (this.bitEncoding & infinity) {
      let b = this.bitEncoding ^ infinity;
      return [
        new BasisBlade(b ^ eplus, this.weight.negate()),
        new BasisBlade(b ^ eminus, this.weight)
      ];
    } else throw new Error("unexpected case");
  }
  toConformalBasis() {
    if ([0b00n, eplane].includes(this.bitEncoding & eplane)) {
      return [new BasisBlade(this.bitEncoding, this.weight)];
    } else if (this.bitEncoding & eplus) {
      let b = this.bitEncoding ^ eplus;
      return [
        new BasisBlade(b ^ origin, this.weight),
        new BasisBlade(b ^ infinity, this.weight.negate().divide(new Rat(2)))
      ];
    } else if (this.bitEncoding ^ eminus) {
      let b = this.bitEncoding ^ eminus;
      return [
        new BasisBlade(b ^ origin, this.weight),
        new BasisBlade(b ^ infinity, this.weight.divide(new Rat(2)))
      ];
    } else throw new Error("unexpected case");
  }
  wedge(that) {
    if (that instanceof BasisBlade)
      return this.bitEncoding & that.bitEncoding ? [ BasisBlade.zero ] : this.multiply(that);
    else throw new Error("unsupported argument type");
  }
  multiply(that) {
    if (!(that instanceof BasisBlade)) throw new Error("unsupported argument type");
    else if (that instanceof Rat) 
      return [new BasisBlade(this.bitEncoding, this.weight.multiply(that))];
    else return [...(
      function*(self) {
        let weight = self.weight.multiply(that.weight),
          $sign = sign(self.bitEncoding, that.bitEncoding);
        for (
          let n = 1, bitEncoding = self.bitEncoding & that.bitEncoding;
        bitEncoding > 0;
        n *= -1, bitEncoding >>= 1n
        ) { if (bitEncoding & 1n) $sign *= n; }
        yield new BasisBlade(
          self.bitEncoding ^ that.bitEncoding,
          weight.multiply(new Polynomial(new Rat($sign)))
        );
      }
      )(this)].reduce((a,b) => a.concat(b), []);
  }
  static consolidate(...blades) {
    let dict = {}
    for (let blade of blades) {
      let key = blade.bitEncoding.toString();
      if (dict[key] == undefined)
        dict[key] = new BasisBlade(blade.bitEncoding, blade.weight);
      else
        dict[key].weight = dict[key].weight.add(blade.weight);
    }
    return Object.values(dict).filter(x => !x.weight.isZero());
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
    if (this.degree == 0) return this.scale.toString();
    else return (
      this.scale.isOne() ? ''  :
      this.scale.opposite.isOne() ? '-' :
    this.scale.toString() + '*'
    ) + this.monomial.toString();
  }
  toTeX() {
    if (this.degree == 0) return this.scale.toTeX();
    else return (this.scale.isOne() ? '' :
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
  isZero() { return this.blades.length == 0 || (this.grade == 0 && this.blades[0].isZero()); }
  equals(that) {
    if (that instanceof MultiVector) {
      return this.subtract(that).isZero();
    } else throw Error("non-multivector argument");
  }
  constructor(...args) {
    if (args.length == 1 && typeof(args[0]) == 'string') {
      throw new Error("direct expression parsing not implemented");
    } else if (args.every(x => x instanceof BasisBlade)) {
        this.blades = args;
    } else {
      throw new Error("wrong constructor argument type");
    }
  }
  toTeX() { return this.isZero() ? '0' : this.blades.map(x => x.toTeX()).join("+"); }
  toString() { return this.blades.map(x => x.toString()).join('+'); }
  get grade() { return Math.max(...this.blades.map(x => x.grade)); }
  diagonalize() {
    return this.blades.map(b => b.toDiagonalBasis()).
      reduce((a,b) => a.concat(b), []);
  }
  conformalize() {
    return this.blades.map(b => b.toConformalBasis()).
      reduce((a,b) => a.concat(b), []);
  }
  add(that) {
    return new MultiVector(...BasisBlade.consolidate(...this.blades.concat(that.blades)));
  }
  multiply(that) {
    if (that instanceof MultiVector) {
      let these = this.diagonalize(), those = that.diagonalize(),
        blades = [
          ...(
            function* () {
              for (let i of these) for (let j of those) for (let ij of i.multiply(j)) {
                yield new MultiVector(ij);
              }
            }
          )()
        ].
          reduce((a,b) => a.add(b), new MultiVector(BasisBlade.zero)).
          conformalize()
        ;
      return new MultiVector(...BasisBlade.consolidate(...blades));
    } else throw new Error("unsupported argument type");
  }
  divide(that) {
    if (that instanceof MultiVector) {
      if (that.grade == 0) {
        let polynomial = that.blades[0].weight;
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
