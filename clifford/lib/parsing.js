const parser = peg.generate(`
start
    = AdditiveExpression

__ = " "*

AdditiveExpression
    = head:MultiplicativeExpression
      tail:(__ AdditiveOperator __ MultiplicativeExpression)*
      {
          return tail.reduce(
              (left, element) => ({ type: element[1], args: [left, element[3]]}),
              head
          );
      }

MultiplicativeExpression
  = head:cdot
    tail:(__ MultiplicativeOperator __ cdot)*
    {
          return tail.reduce(
              (left, element) => ({ type: element[1], args: [left, element[3]]}),
              head
          );
    }

AdditiveOperator
  = "+" { return "addition"; }
  / "-" { return "subtraction"; }

MultiplicativeOperator
  = "/" { return "division"; }
  / "*" { return "multiplication"; }

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
            type: "∧",
            args: [ left, right ]
        }
    } / UnaryExpression

UnaryExpression
    = type:UnaryOperator __ argument:UnaryExpression {
        return { type, args: [ argument ] }
    }
    / exponential

exponential
    =  left:primary '**' right:DecimalIntegerLiteral {
        return { type: "exponentiation", args: [ left, parseInt(right) ] }
    }
    / left:primary '²' {
      return { type: "exponentiation", args: [ left, 2 ] }
    }
    / primary

primary
    = LiteralNumber
    / Variable
    / BasisVector 
    / "(" additive:AdditiveExpression ")" { return additive; }

LiteralNumber
    = sign? DecimalIntegerLiteral { return { type: "number", args: [ text() ] } }

decimal_point = "."

DecimalIntegerLiteral
  = "0"
  / NonZeroDigit DecimalDigit*

sign = minus / plus

minus = "-"

plus = "+"

zero = "0"

DecimalDigit = [0-9]

NonZeroDigit = [1-9]

Variable = [a-z] { return { type: "variable", args: text() } }

BasisVector
  = EuclideanBasisVector 
  / AntiEuclideanBasisVector

EuclideanBasisVector = "$" index:DecimalIntegerLiteral {
    return { type: "basis vector", args: [ +1, index ] }
}

AntiEuclideanBasisVector = "#" index:DecimalIntegerLiteral {
    return { type: "basis vector", args: [ -1, index ] }
}
`);
