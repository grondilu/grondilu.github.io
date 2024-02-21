// CREDITS:
// https://codereview.stackexchange.com/questions/230826/chess-game-in-javascript

'use strict';

console.clear();

// some ES6 symbols
const BLACK = Symbol();
const WHITE = Symbol();

const KING   = Symbol();
const QUEEN  = Symbol();
const ROOK   = Symbol();
const BISHOP = Symbol();
const KNIGHT = Symbol();
const PAWN   = Symbol();

const SHORT  = Symbol();
const LONG   = Symbol();

const startpos = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const BOARD_SIZE = 800 // pixels
const canvas = document.getElementById("board");
canvas.height = canvas.width  = BOARD_SIZE;
const ctx = canvas.getContext("2d");

// sound
var sounds = {
  move: document.createElement("audio")
};
sounds.move.src = 'https://github.com/lichess-org/lila/raw/master/public/sound/standard/Move.ogg';
sounds.move.setAttribute('preload', 'auto');
sounds.move.setAttribute('controls', 'none');
sounds.move.style.display = 'none';
document.body.appendChild(sounds.move);

function clearBoard() {
  let size = Math.min(ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.scale(size/8,size/8);
  for (let i=0;i<8;i++)
    for (let j=0;j<8;j++) {
      ctx.fillStyle = ((i + j)%2 ? "dark" : "light") + "gray"
      ctx.fillRect(i,j,1,1);
    }
  ctx.restore();
}

// Pieces image set from Wikimedia:
// https://upload.wikimedia.org/wikipedia/commons/b/b2/Chess_Pieces_Sprite.svg
const PIECE_SIZE = 45;
const piecesSVG = new Image();
if (localStorage.getItem("Chess_Pieces_Sprite.svg")) {
  console.info("retrieving local copy of the pieces svg file");
  piecesSVG.src = "data:image/svg+xml;base64," + localStorage.getItem("Chess_Pieces_Sprite.svg");
} else {
  fetch(piecesSVG.src = "https://upload.wikimedia.org/wikipedia/commons/b/b2/Chess_Pieces_Sprite.svg")
    .then(blob => blob.text())    
    .then(text => { localStorage.setItem("Chess_Pieces_Sprite.svg", window.btoa(text)); });
}

// Piece class definition
class Piece {
  constructor(letter) {
    this.letter = letter;
  }
  get type() {
    if (/k/i.test(this.letter)) return KING;
    if (/q/i.test(this.letter)) return QUEEN;
    if (/r/i.test(this.letter)) return ROOK;
    if (/b/i.test(this.letter)) return BISHOP;
    if (/n/i.test(this.letter)) return KNIGHT;
    if (/p/i.test(this.letter)) return PAWN;
  }
  get color() { return /[kqbnrp]/.test(this.letter) ? BLACK : WHITE; }
  draw(context, x, y) {
    context.save();
    let scale = BOARD_SIZE/8/PIECE_SIZE;
    context.scale(scale, scale);
    context.drawImage(
      piecesSVG,
      ...[
        ...{
        "k": [0,1], "K": [0,0],
        "q": [1,1], "Q": [1,0],
        "b": [2,1], "B": [2,0],
        "n": [3,1], "N": [3,0],
        "r": [4,1], "R": [4,0],
        "p": [5,1], "P": [5,0],
        }[this.letter],
        1, 1,
        x, y,
        1, 1
      ].map(x => PIECE_SIZE*x)
    );
    context.restore();
  }
}

class Square {
  constructor(name) {
    if (/^[a-h][1-8]$/.test(name)) {
      let row    = name.substr(1,1),
          column = name.substr(0, 1);
      this.name = name;
      this.x = "abcdefgh".indexOf(column);
      this.y = 8 - row;
    } else throw `wrong square name ${name}`;
  }
  get left() {
    if (/^a/.test(this.name)) throw "there is no square to the left of the first column";
    return new Square("abcdefg"["bcdefgh".indexOf(this.name.substr(0,1))] + this.name.substr(1, 1));
  }
  get right() {
    if (/^h/.test(this.name)) throw "there is no square to the right of the last column";
    return new Square("bcdefgh"["abcdefg".indexOf(this.name.substr(0,1))] + this.name.substr(1, 1));
  }
  get up() {
    if (/8$/.test(this.name)) throw "there is no square above the last row";
    return new Square(this.name.substr(0, 1) + (+this.name.substr(1, 1) + 1).toString());
  }
  get down() {
    if (/1$/.test(this.name)) throw "there is no square below the first row";
    return new Square(this.name.substr(0, 1) + (+this.name.substr(1, 1) - 1).toString());
  }
  toString() { return this.name; }
}

class Position {
  constructor(FEN = startpos) {
    let fields = FEN.split(' '),
        board = fields[0],
        c;
    if (!/^(?:[pbnbrqk1-8]{1,8}\/){7}[pbnrqk1-8]{1,8}$/i.test(board))
        throw "wrong format for board";
    if (!/^[wb]$/.test(fields[1])) throw 'no turn field';
    if (!/^(?:-|[a-h][36])$/.test(fields[3])) throw 'wrong en-passant field';
    
    this.turn = fields[1] == 'w' ? WHITE : BLACK;
    this.castlingRights = fields[2];
    this.enpassant = fields[3];
    this.fiftymovescount = +fields[4];
    this.movenumber = +fields[5];

    this.pieces = new Map();

    let [i,j] = [0, 0];
    for (c of board.split('')) {
      if (c == '/') {
        j++; i = 0;
      } else if (/[1-8]/.test(c)) {
        i+=+c;
      } else {
        this.pieces.set("abcdefgh"[i++] + (8 - j).toString(), new Piece(c));
      }  
    }    
  }
  *pseudoLegalMoves() {
    const HORIZONTAL_STEPS = [ s => s.left, s => s.right ];
    const VERTICAL_STEPS   = [ s => s.up,   s => s.down  ];
    const BISHOP_STEPS     = [ s => s.up.left, s => s.up.right, s => s.down.left, s => s.down.right ];
    const ROOK_STEPS       = [...HORIZONTAL_STEPS, ...VERTICAL_STEPS];
    const ROYAL_STEPS      = [...ROOK_STEPS, ...BISHOP_STEPS];
    const KNIGHT_STEPS     = [ s => s.up.up.left, s => s.up.up.right, s => s.left.left.up, s => s.left.left.down, s => s.down.down.left, s => s.down.down.right, s => s.right.right.up, s => s.right.right.down ];

    for(let kv of this.pieces) {
      let [square, piece] = kv;
      if (piece.color !== this.turn) continue;
      let from = new Square(square);
      let pieces = this.pieces;
      function* linearMoves(...moves) {
        for (let move of moves) {
          let to = from;
          while (true) {
            try {
              to = move(to);
              let otherpiece = pieces.get(to.name);
              if (otherpiece && otherpiece.color == piece.color)
                throw "blocked";
              yield { from, to }
              if (otherpiece && otherpiece.color !== piece.color)
                throw "capture";
            } catch(err) { break; }
          }
        }
      }
      switch (piece.type) {
        case KING:
          for (let move of ROYAL_STEPS) {
            try {
              let to = move(from),
                otherpiece = this.pieces.get(to.name);
              if (!otherpiece || (otherpiece.color !== piece.color))
                yield { from, to }
            } catch (err) {}
          }
          // CASTLING
          let row = this.turn == WHITE ? '1' : '8';
          if (from.name == 'e'+row) {
            if (!pieces.get('f'+row) && !pieces.get('g'+row))
              yield { from, to: new Square('g'+row), castling: SHORT }
            if (!pieces.get('d'+row) && !pieces.get('c'+row))
              yield { from, to: new Square('c'+row), castling: LONG }
          }
          break;
        case QUEEN:
          for (let move of linearMoves(...ROYAL_STEPS)) yield move;
          break;
        case ROOK:
          for (let move of linearMoves(...ROOK_STEPS)) yield move;
          break;
        case BISHOP:
          for (let move of linearMoves(...BISHOP_STEPS)) yield move;
          break;
        case KNIGHT:
          for (let move of KNIGHT_STEPS) {
            try {
              let to = move(from),
                otherpiece = this.pieces.get(to.name);
              if (!otherpiece || (otherpiece && otherpiece.color !== piece.color))
                yield { from, to }
            } catch (err) {}
          }
          break;
        case PAWN:
          //TODO: en-passant
          let [direction, secondOrSeventhRow] = 
              piece.color == WHITE ? [s => s.up, /2$/] : [s => s.down, /7$/];
          let to = direction(from);
          if (!this.pieces.get(to.name)) {
            yield { from, to }
            if (secondOrSeventhRow.test(from.name)) {
              to = direction(to);
              if (!this.pieces.get(to.name))
                yield { from, to }
            }
          }
          for (let move of [s => direction(s).left, s => direction(s).right]) {
            try {
              let to = move(from),
                otherPiece = this.pieces.get(to.name);
              if (otherPiece && otherPiece.color !== piece.color)
                yield { from, to, capture: true }
            } catch (err) {}
          }
          break;
        default: throw "unknown piece";
      }
    }
  }
  get FEN() {
    let board = '';
    for (let k = 0; k<64; k++) {
      let y = Math.floor(k / 8), x = k % 8;
      let p = this.pieces.get("abcdefgh"[x] + (8 - y).toString());
      board += p ? p.letter : '1';
      if (k % 8 == 7 && y !== 7) board += '/';
    }
    return [
      board
        .replaceAll('11', '2')
        .replaceAll('21', '3')
        .replaceAll('22', '4')
        .replaceAll('41', '5')
        .replaceAll('42', '6')
        .replaceAll('43', '7')
        .replaceAll('44', '8'),
      this.turn == WHITE ? 'w' : 'b',
      this.castlingRights,
      this.enpassant,
      this.fiftymovescount,
      this.movenumber
    ].join(' ');
  }
  get check() {
    let position = new Position(this.FEN);
    position.turn = position.turn == WHITE ? BLACK : WHITE;
    for (let move of position.pseudoLegalMoves()) {
      let otherpiece = position.pieces.get(move.to.name);
      if (otherpiece && otherpiece.type == KING && otherpiece.color !== position.turn)
        return true;
    }
    return false;
  }
}

class Move {
  constructor(position, from, to) {
    if (
      position instanceof Position &&
          from instanceof Square &&
            to instanceof Square
    ) {
      this.position = new Position(position.FEN);
      let pseudoLegalMove = 
        Array.from(this.position.pseudoLegalMoves())
        .find(x => (x.from.name+x.to.name) == from.name+to.name);
      if (!pseudoLegalMove) throw "move is not even pseudo legal";
      this.from      = pseudoLegalMove.from;
      this.to        = pseudoLegalMove.to;      
      this.castling  = pseudoLegalMove.castling;
      this.enpassant = pseudoLegalMove.enpassant;
    } else throw "wrong argument type";
  }
  make() {
    this.position.fiftymovescount++;
    let movedPiece = this.position.pieces.get(this.from.name),
        otherpiece = this.position.pieces.get(this.to.name);
    if (otherpiece && otherpiece.type == KING) throw "A king cannot be taken";
    if (otherpiece) this.position.fiftymovescount = 0;

    // CASTLING
    if (this.castling) {
      if (!{
        [SHORT]: { [WHITE]: /K/, [BLACK]: /k/ },
        [LONG]:  { [WHITE]: /Q/, [BLACK]: /q/ }
      }[this.castling][this.position.turn].test(this.position.castlingRights))
        throw "castling is not allowed";
      let row = this.position.turn == WHITE ? '1' : '8',
        columns = this.castling == SHORT ? "efgh" : "edcba",
        position = new Position(this.position.FEN);
      position.turn = position.turn == WHITE ? BLACK : WHITE;
      let pseudoLegalMoves = Array.from(position.pseudoLegalMoves());
      if (pseudoLegalMoves.filter(m => m.to.name == columns.substr(1, 1) + row).length > 0)
        throw `square ${columns.substr(1, 1) + row} is attacked, so castling is not allowed`;
      // move the rook
      this.position.pieces.set(columns.substr(1, 1) + row, this.position.pieces.get(columns.substr(-1, 1) + row));
      this.position.pieces.delete(columns.substr(-1, 1) + row);
    }
    if (this.position.castlingRights !== '-') {
      switch (movedPiece.type) {
        case KING:
          // the king has moved, mark castling as impossible
          this.position.castlingRights =
            this.position.castlingRights.replaceAll(this.position.turn == WHITE ? /[KQ]/g : /[kq]/g, '');
          break;
        case ROOK:
          // the rook has moved, mark corresponding castling as impossible
          if (/^a/.test(this.from.name))
            this.position.castlingRights =
              this.position.castlingRights.replaceAll(this.position.turn == WHITE ? /Q/g : /q/g, '');
          if (/^h/.test(this.from.name))
            this.position.castlingRights =
              this.position.castlingRights.replaceAll(this.position.turn == WHITE ? /K/g : /k/g, '');
      }
      if (this.position.castlingRights == '') this.position.castlingRights = '-'
    }

    this.position.pieces.set(this.to.name, this.position.pieces.get(this.from.name));
    this.position.pieces.delete(this.from.name);
    if (this.position.check) throw "check must be evaded";
    this.position.turn = this.position.turn == WHITE ? BLACK : WHITE;
    if (this.position.turn == WHITE) this.position.movenumber++;
    sounds.move.play();
    return this.position;
  }
  long_algebraic() { return this.from.toString() + this.to.toString(); }
}

var position    = new Position();
var movingPiece = null;
var animationFrameHandles = {
  movingPiece: null,
  recordLayer: null
};

var x, y;
var ox, oy;

function draw() {

  clearBoard();
  position.pieces.forEach(
    (piece, s) => {
      let square = new Square(s);
      if (movingPiece !== null && square.name == movingPiece.square.name) {
        position.pieces.get(square.name).draw(ctx, movingPiece.x, movingPiece.y);
      } else piece.draw(ctx, square.x, square.y);
    }
  );
}

function animate() {
  draw();
  animationFrameHandles.movingPiece = requestAnimationFrame(animate);
}

var diskColors = ['#FF000000', '#FF000055'];
setInterval(() => diskColors = diskColors.reverse(), 1000);

function recordLayer() {
  let radius = 100;
  ctx.save();
  ctx.fillStyle = '#FF000020';
  ctx.fillRect(0,0, ctx.canvas.width, ctx.canvas.height);
  ctx.beginPath();
  ctx.fillStyle = diskColors[0];
  ctx.arc(radius,radius, radius, 0, 2*Math.PI);
  ctx.fill();
  ctx.restore();
}

addEventListener(
  "mousedown",
  e => {
    if (movingPiece === null) {
      let rect = canvas.getBoundingClientRect();
      let [c, r] = [e.clientX - rect.x, e.clientY - rect.y].map($ => Math.floor($*8/BOARD_SIZE));
      let square = new Square("abcdefgh"[c] + (8 - r).toString());
      let p = position.pieces.get(square.name);
      if (!p) {
        console.warn("no piece here");
      } else if (p.color !== position.turn) {
        console.warn("wrong color for current turn");
      } else {
        movingPiece = { square, x: c, y: r };
        [x, y] = [e.clientX - rect.x, e.clientY - rect.y].map($ => $*8/BOARD_SIZE);
        [ox, oy] = [movingPiece.x, movingPiece.y];
        animationFrameHandles.movingPiece = requestAnimationFrame(animate);    
      }
    }
  }
);
addEventListener(
  "mousemove",
  e => {
    if (movingPiece !== null) {
      let rect = canvas.getBoundingClientRect(),
          [c, r] = [e.clientX - rect.x, e.clientY - rect.y].map($ => $*8/BOARD_SIZE);
      movingPiece.x = c - x + ox;
      movingPiece.y = r - y + oy;      
    }
  }
);
addEventListener(
  "mouseup",
  e => {
    if (movingPiece !== null) {
      movingPiece.x = Math.floor(movingPiece.x + .5);
      movingPiece.y = Math.floor(movingPiece.y + .5);
      if (movingPiece.x !== ox || movingPiece.y !== oy) {
        let from = new Square("abcdefgh"[ox] + (8 - oy).toString()),
            to   = new Square("abcdefgh"[movingPiece.x] + (8 - movingPiece.y).toString());
        console.log(`${position.turn == WHITE ? 'White' : 'Black'} moved from ${from.toString()} to ${to.toString()}`); 
        try {
          position = new Move(position, from, to).make();
          if (position.check) throw "check!";
        } catch(err) { console.warn(err); }
      }
      console.log(position.FEN);
      movingPiece = null;
      requestAnimationFrame(
        () => {
          cancelAnimationFrame(animationFrameHandles.movingPiece);
        }
      );
    }
  }
);

piecesSVG.onload = draw;

