function BigIntGCD(a, b) { return BigInt(b ? BigIntGCD(b, a % b) : (a > 0 ? a : -a)); }

class Rat {
  constructor(num, den = 1) {
    let numerator = BigInt(num),
      denominator = BigInt(den),
      gcd = BigIntGCD(numerator, denominator);
    this.numerator = numerator/gcd;
    this.denominator = denominator/gcd;
  }
  add(that) { return new Rat(this.numerator*that.denominator + that.numerator*this.denominator, this.denominator*that.denominator); }
  subtract(that) { return this.add(that.opposite); }
  multiply(that) { return new Rat(this.numerator*that.numerator, this.denominator*that.denominator); }
  divide(that) { return new Rat(this.numerator*that.denominator, this.denominator*that.numerator); }
  toString() { return this.denominator == 1 ? this.numerator.toString() : this.numerator+"/"+this.denominator; }
  toTeX() { return this.denominator == 1 ? this.numerator.toString() : '\\frac{' + this.numerator + '}{' + this.denominator + '}'; }
  isOne() { return this.numerator === this.denominator; }
  isZero() { return this.numerator == 0; }
  get opposite() { return new Rat(-this.numerator, this.denominator); }
  static get zero() { return new Rat(0); }
  static get one() { return new Rat(1); }
}
