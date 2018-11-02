start
    = AdditiveExpression

__ = " "*

AdditiveExpression
    = head:MultiplicativeExpression
      tail:(__ AdditiveOperator __ MultiplicativeExpression)*
      {
          return tail.reduce(
            (left, element) => ({ ...element[1], args: [left, element[3]] }),
              head
          );
      }

MultiplicativeExpression
  = head:cdot
    tail:(__ MultiplicativeOperator __ cdot)*
    {
          return tail.reduce(
              (left, element) => ({ ...element[1], args: [left, element[3]] }),
              head
          );
    }

AdditiveOperator
  = "+" { return { op: (a,b) => a.add(b), type: "operator", name: "addition", symbol: "+" }; }
  / "-" { return { op: (a,b) => a.subtract(b), type: "operator", name: "subtraction", symbol: "-" }; }

MultiplicativeOperator
  = "/" { return { op: (a,b) => a.divide(b), type: "operator", name: "division", symbol: "/" }; }
  / "*" { return { op: (a,b) => a.multiply(b), type: "operator", name: "multiplication", symbol: "*" }; }

UnaryOperator
  = "+"
  / "-"

cdot
    = left:wedge "·" right:wedge {
        return {
            type: "·",
            args: [ left, right ]
        }
    } / wedge

wedge
    = left:UnaryExpression '∧' right:wedge {
        return {
            type: "operator",
            name: "outer product",
            symbol: "∧",
            args: [ left, right ],
            op: (a,b) => a.wedge(b)
        }
    } / UnaryExpression

UnaryExpression
    = type:UnaryOperator __ argument:UnaryExpression {
        return { type, args: [ argument ] }
    }
    / exponential

exponential
    =  left:primary '**' right:DecimalIntegerLiteral {
      return {
        type: "operator",
        name: "exponentiation",
        op: function exponentiate(b, n) {
           if (n==0) return b.one;
           if (n==1) return b;
           return (x => n % 2 == 0 ? x : x.multiply(b))(
               (x => x.multiply(x))(exponentiate(b, Math.floor(n/2)))
               );
           },
        args: [left, parseInt(right)]
      };
    }
    / left:primary '²' {
        return {
          type: "operator",
          name: "square",
          op: x => x.multiply(x),
          args: [left]
        }
    }
    / primary

primary
    = LiteralNumber
    / BasisVector 
    / Variable
    / "(" additive:AdditiveExpression ")" { return additive; }

LiteralNumber
    = sign? DecimalIntegerLiteral { return { type: "number", args: [ text() ] } }

decimal_point = "."

DecimalIntegerLiteral
  = "0" 
  / NonZeroDigit DecimalDigit* { return text(); }

sign = minus / plus

minus = "-"

plus = "+"

zero = "0"

DecimalDigit = [0-9]

NonZeroDigit = [1-9]

Variable = [a-z] { return { type: "variable", args: [ text() ] } }

BasisVector
  = EuclideanBasisVector 
  / AntiEuclideanBasisVector
  / NullBasisVector

NullBasisVector
  = "n" letter:[io] { return { type: "null basis vector", args: [ text() ] } }

EuclideanBasisVector = "$" index:DecimalIntegerLiteral {
    return { type: "euclidean basis vector", args: [ index ] }
}

AntiEuclideanBasisVector = "_" index:DecimalIntegerLiteral {
    return { type: "anti-euclidean basis vector", args: [ index ] }
}
