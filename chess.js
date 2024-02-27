// CREDITS:
// https://codereview.stackexchange.com/questions/230826/chess-game-in-javascript

'use strict';

// Ideas:
// * drag empty square from left to right to validate line
// * drag empty square from right to left to erase line (with window.confirm)
// * in training, drag empty square anywhere to stop training and start editing
//
// * For promotion, a simple method would consist in successive confirm popup windows

const DEBUG = true;

// some ES6 symbols
// https://chat.openai.com/share/3bca29af-2da5-4469-98e5-378e045c697c
const
  BLACK  = Symbol('color'),
  WHITE  = Symbol('color'),

  KING   = Symbol('chess piece'),
  QUEEN  = Symbol('chess piece'),
  ROOK   = Symbol('chess piece'),
  BISHOP = Symbol('chess piece'),
  KNIGHT = Symbol('chess piece'),
  PAWN   = Symbol('chess piece'),

  SHORT  = Symbol('castling type'),
  LONG   = Symbol('castling type'),

  EDITING  = Symbol('operating mode'),
  TRAINING = Symbol('operating mode');


const startpos = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const BOARD_SIZE = 800 // pixels
const canvas = document.getElementById("board");
canvas.height = canvas.width  = BOARD_SIZE;
const ctx = canvas.getContext("2d");

const STORAGE = DEBUG ? sessionStorage : localStorage;

{ // sound
  var sounds = {
    move: document.createElement("audio")
  };
  //sounds.move.src = 'https://github.com/lichess-org/lila/raw/master/public/sound/standard/Move.ogg';
  // data uri at the end of the file

  sounds.move.setAttribute('preload', 'auto');
  sounds.move.setAttribute('controls', 'none');
  sounds.move.setAttribute('allow', 'autoplay');
  sounds.move.style.display = 'none';
  document.body.appendChild(sounds.move);
}

function clearBoard(context) {
  let size = Math.min(context.canvas.width, context.canvas.height);
  context.save();
  context.scale(size/8,size/8);
  for (let i=0;i<8;i++)
    for (let j=0;j<8;j++) {
      context.fillStyle = ((i + j)%2 ? "dark" : "light") + "gray"
      context.fillRect(i,j,1,1);
    }
  context.restore();
}

const PIECE_SIZE = 45, piecesSVG = new Image();
// Pieces image set from Wikimedia:
// https://upload.wikimedia.org/wikipedia/commons/b/b2/Chess_Pieces_Sprite.svg
// data uri at the end of the file

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
  draw_test() {
  }
  draw(context, x, y, dx = 0, dy = 0) {
    context.save();
    let scale = BOARD_SIZE/8;
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
        }[this.letter].map(x => PIECE_SIZE*x),
        PIECE_SIZE, PIECE_SIZE,
        x + dx, y + dy,
        1, 1
      ]
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
  get clone() { return new Position(this.FEN); }
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
                yield { from, to }
            } catch (err) {}
          }
          // EN PASSANT
          if (this.enpassant !== '-') {
            let to = new Square(this.enpassant);
            if (this.pieces.get(to.name)) throw `en passant square ${to.name} is occupied!?`;
            if ((piece.color == WHITE ? /6$/ : /3$/).test(to.name)) {
              if ((piece.color == WHITE ? /5$/ : /4$/).test(from.name)) {
                if (Math.abs(from.x - to.x) == 1 && Math.abs(from.y - to.y) == 1) {
                  yield { from, to, enpassant: this.turn == WHITE ? to.down : to.up }
                }
              }
            }
          }
          break;
        default: throw "unknown piece";
      }
    }
  }
  get legalMoves() {
    let key = this.FEN + ':legalMoves',
      cache = STORAGE.getItem(key);
    if (cache) {
      //console.log(`retrieving legalMoves cache for ${this.FEN}`);
      return JSON.parse(cache)
        .map(m => new Move(this, new Square(m.substr(0, 2)), new Square(m.substr(2, 2))));
    }
    else {
      console.log('computing legal moves');
      let result = [];
      for (let pseudoMove of this.pseudoLegalMoves()) {
        let move = new Move(this, pseudoMove.from, pseudoMove.to);
        try {
          move.make();
        } catch(err) { continue; }
        result.push(move);
      }
      STORAGE.setItem(key, JSON.stringify(result.map(m => m.la)));
      return result;
    }
  }
  draw() {
    clearBoard(ctx);
    this.pieces.forEach(
      (piece, s) => {
        let square = new Square(s);
        piece.draw(ctx, flip(square.x), flip(square.y));
      }
    );
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
      this.position = position;
      let pseudoLegalMove = 
        Array.from(this.position.pseudoLegalMoves())
        .find(x => (x.from.name+x.to.name) == from.name+to.name);
      if (!pseudoLegalMove) throw "move is not even pseudo legal";
      this.from      = pseudoLegalMove.from;
      this.to        = pseudoLegalMove.to;      
      if (pseudoLegalMove.castling)  this.castling  = pseudoLegalMove.castling;
      if (pseudoLegalMove.enpassant) this.enpassant = pseudoLegalMove.enpassant;
    } else throw "wrong argument type";
  }
  get a() {
    let 
      result = '',
      move = this,
      capture = this.position.pieces.get(this.to.name) || this.enpassant,
      piece   = this.position.pieces.get(this.from.name),
      piecename = {
        [KING]: 'K',
        [QUEEN]: 'Q',
        [ROOK]: 'R',
        [BISHOP]: 'B',
        [KNIGHT]: 'N',
        [PAWN]: move.from.name.substr(0,1)
      }[piece.type],
      otherMoves = this.position.legalMoves.filter(
        x => {
          let la = x.la;
          la.substr(2, 2) == this.to.name
          && la.substr(0, 4) !== this.from.name + this.to.name
          && this.position.pieces.get(x.from.name).type == piece.type
        }
      ),
      otherMovesOnTheSameColumn = otherMoves.filter(x => x.la.substr(0, 1) == this.from.name.substr(0, 1)),
      otherMovesOnTheSameRow    = otherMoves.filter(x => x.la.substr(1, 1) == this.from.name.substr(1, 1)),
      disambiguation;
    if (otherMoves.length > 0) {
      console.warn("disambiguation is needed");
      if (otherMovesOnTheSameColumn.length == 0)
        disambiguation = this.from.name.substr(0, 1);
      else if (otherMovesOnTheSameRow.length == 0)
        disambiguation = this.from.name.substr(1, 1);
      else
        disambiguation = this.from.name;
    }

    if (piece.type == PAWN)
      result += (capture ? piecename + (disambiguation ? disambiguation : '') + 'x' : '') + this.to.name;
    else if (this.castling)
      result += this.castling == SHORT ? 'O-O' : 'O-O-O';
    else
      result += piecename + (disambiguation ? disambiguation : '') + (capture ? 'x' : '') + this.to.name;
    if (this.make().check) result += '+';
    return result;
  }
  make() {
    let position = new Position(this.position.FEN);
    position.fiftymovescount++;
    let movedPiece = position.pieces.get(this.from.name),
        otherpiece = position.pieces.get(this.to.name),
        enpassant  = position.enpassant;
    if (otherpiece) {
      if (otherpiece.type == KING) throw "A king cannot be taken";
      position.fiftymovescount = 0;
    }

    if (movedPiece.type == PAWN) {
      position.fiftymovescount = 0;
      if (Math.abs(this.to.y - this.from.y) == 2) {
        let
          direction = position.turn == WHITE ? s => s.up : s => s.down,
          enpassant = direction(this.from);
        for (let step of [s => s.left, s => s.right]) {
          try {
            let otherpiece = position.pieces.get(step(this.to).name);
            if (otherpiece && otherpiece.type == PAWN && otherpiece.color !== position.turn) {
              position.enpassant = enpassant.name;
              break;
            }
          } catch (err) { }
        }
      }
    }
    // CASTLING
    if (this.castling) {
      if (!{
        [SHORT]: { [WHITE]: /K/, [BLACK]: /k/ },
        [LONG]:  { [WHITE]: /Q/, [BLACK]: /q/ }
      }[this.castling][position.turn].test(position.castlingRights))
        throw "castling is not allowed";
      let row = position.turn == WHITE ? '1' : '8',
        columns = this.castling == SHORT ? "efgh" : "edcba";
      position.turn = position.turn == WHITE ? BLACK : WHITE;
      let pseudoLegalMoves = Array.from(position.pseudoLegalMoves());
      if (pseudoLegalMoves.filter(m => m.to.name == columns.substr(1, 1) + row).length > 0)
        throw `square ${columns.substr(1, 1) + row} is attacked, so castling is not allowed`;
      // move the rook
      position.pieces.set(columns.substr(1, 1) + row, position.pieces.get(columns.substr(-1, 1) + row));
      position.pieces.delete(columns.substr(-1, 1) + row);
      position.turn = position.turn == WHITE ? BLACK : WHITE;
    }
    if (position.castlingRights !== '-') {
      switch (movedPiece.type) {
        case KING:
          // the king has moved, mark castling as impossible
          position.castlingRights =
            position.castlingRights.replaceAll(position.turn == WHITE ? /[KQ]/g : /[kq]/g, '');
          break;
        case ROOK:
          // the rook has moved, mark corresponding castling as impossible
          if (/^a/.test(this.from.name))
            position.castlingRights =
              position.castlingRights.replaceAll(position.turn == WHITE ? /Q/g : /q/g, '');
          if (/^h/.test(this.from.name))
            position.castlingRights =
              position.castlingRights.replaceAll(position.turn == WHITE ? /K/g : /k/g, '');
      }
      if (position.castlingRights == '') position.castlingRights = '-'
    }

    position.pieces.set(this.to.name, position.pieces.get(this.from.name));
    position.pieces.delete(this.from.name);
    if (enpassant !== '-') position.pieces.delete(this.enpassant.name);
    let position2 = new Position(position.FEN);
    if (position2.enpassant !== '-') position2.enpassant = '-';
    if (position2.check) throw "check must be evaded";
    if (enpassant !== '-') position.enpassant = '-';
    position.turn = position.turn == WHITE ? BLACK : WHITE;
    if (position.turn == WHITE) position.movenumber++;
    return position;
  }
  // "la" stands for "long algebraic"
  get la() { return this.from.toString() + this.to.toString(); }
}

var position    = new Position();
var movingPiece = null;
var animationFrameHandles = {
  movingPiece: null
};
var moves = [];
var scores = new Map();
var flipped = false;
function flip(x) { return flipped ? 7 - x : x }

var operatingMode = EDITING;

var emptySquareDrag = null;
var expectedMove, line;

function draw() {
  clearBoard(ctx);
  position.pieces.forEach(
    (piece, s) => {
      let square = new Square(s);
      if (movingPiece !== null && square.name == movingPiece.square.name) {
        piece
          .draw(
            ctx,
            flipped ? 7 - square.x : square.x, flipped ? 7 - square.y : square.y,
            (movingPiece.mouse.to.x - movingPiece.mouse.from.x)/(BOARD_SIZE/8),
            (movingPiece.mouse.to.y - movingPiece.mouse.from.y)/(BOARD_SIZE/8)
          );
      } else piece.draw(ctx, flipped ? 7 - square.x : square.x, flipped ? 7 - square.y : square.y);
    }
  );
}

function animate() {
  draw();
  animationFrameHandles.movingPiece = requestAnimationFrame(animate);
}

function save() {
  let json = {
    scores: JSON.stringify(scores)
  }
  STORAGE.setItem("scores", json.scores);
}

{ // Event listeners
  //
  addEventListener(
    "keydown",
    e => {
      switch (operatingMode) {
        case EDITING:
          if (e.key == 't') {
            //document.getElementById('temperature').style.visibility = 'visible';
            document.getElementById('pgn').innerHTML = '';
            document.getElementById('messages').innerHTML = 'TRAINING MODE';
            console.log("start training");
            train();
          }
          break;
        case TRAINING:
          if (e.key == 'e') {
            flipped = false;
            operatingMode = EDITING;
            document.getElementById('messages').innerHTML = 'EDITING MODE';
            document.getElementById('temperature').style.visibility = 'hidden';
            console.log("start editing");
            position = new Position();
            expectedMove = null;
            draw();
          }
          break;
      }
    }
  );

  addEventListener(
    "mousedown",
    e => {
      let rect = canvas.getBoundingClientRect(),
        mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (mouse.x >= 0 && mouse.x < canvas.width && mouse.y >= 0 && mouse.y < canvas.height) {
        let [x, y] = [mouse.x, mouse.y].map($ => $*8/BOARD_SIZE),
          square = new Square("abcdefgh"[flip(Math.floor(x))] + (8 - flip(Math.floor(y))).toString()),
          p = position.pieces.get(square.name);
        switch (operatingMode) {
          case TRAINING:
            if (!expectedMove) {
              console.warn("no move is expected");
              break;
            }
          default:
            if (movingPiece === null) {
              if (!p)
                emptySquareDrag = [ { x: e.clientX, y: e.clientY } ];
              else if (p.color !== position.turn)
                console.warn((p.color == WHITE ? "Black" : "White") + " to move");
              else {
                movingPiece = { square, mouse: { from: mouse, to: mouse } };
                draw();
                animationFrameHandles.movingPiece = requestAnimationFrame(animate);    
              }
            } else console.warn("a piece is still moving");
            break;
        }
      }
    }
  );
  addEventListener(
    "mousemove",
    e => {
      let rect = canvas.getBoundingClientRect();
      if (movingPiece !== null)
        movingPiece.mouse.to = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      else if (emptySquareDrag)
        emptySquareDrag[1] = { x: e.clientX, y: e.clientY };
    }
  );
  addEventListener(
    "mouseup",
    e => {
      if (movingPiece !== null) {
        let destination = new Square(
          "abcdefgh".substr(flip(Math.floor(movingPiece.mouse.to.x/(BOARD_SIZE/8))), 1)
          + (8 - flip(Math.floor(movingPiece.mouse.to.y/(BOARD_SIZE/8)))).toString()
        );
        if (movingPiece.square.name !== destination.name) {
          let from = movingPiece.square,
              to   = destination;
          try {
            let move = new Move(position, from, to);
            position = move.make();
            switch (operatingMode) {
              case TRAINING:
                if (!scores.has(line)) scores.set(line, 0);
                if (expectedMove && expectedMove.la == move.la) {
                  console.log("good move!");
                  scores.set(line, scores.get(line)+1);
                  expectedMove = null;
                  setTimeout(train, 1000);
                }
                else {
                  console.log(`${expectedMove.a} was expected`);
                  scores.set(line, scores.get(line)-1);
                  setTimeout(train, 5000);
                }
                break;
              case EDITING:
                moves.push(move);
                document.getElementById('pgn').innerHTML =
                  moves.map(m => (m.position.turn == WHITE ? m.position.movenumber + '.' : '') + m.a).join(' ');
              default:
                sounds.move.play();
            }
          } catch(err) { console.warn(err); }
          if (position.check) console.warn("check!");
        } else console.log("not moving");
        movingPiece = null;
        requestAnimationFrame(
          () => cancelAnimationFrame(animationFrameHandles.movingPiece)
        );
      } else if (emptySquareDrag && emptySquareDrag[1]) {
        if (Math.floor(emptySquareDrag[1].x) - Math.floor(emptySquareDrag[0].x) > BOARD_SIZE/8) {
          if (moves.length > 0) {
            let line = moves.map(m => m.la).join(' ');
            console.log(line);
            if (operatingMode == EDITING) scores.set(line, 0);
            moves = [];
            position = new Position();
            draw();
            document.getElementById('pgn').innerHTML = '';
          }
        }
        else if (Math.floor(emptySquareDrag[0].x) - Math.floor(emptySquareDrag[1].x) > BOARD_SIZE/8) {
          console.log("empty square was dragged to the left");
          let confirmation = window.confirm("erase line?");
        }
        else if (Math.floor(emptySquareDrag[0].y) - Math.floor(emptySquareDrag[1].y) > BOARD_SIZE/8) {
          flipped = !flipped;
          draw();
        }
        emptySquareDrag = null;
      }
    }
  );
}
    
function train() {
  operatingMode = TRAINING;
  let lines = Array.from(scores.keys());
  if (lines.length > 0) {
    line = lines[Math.floor(Math.random()*lines.length)];
    let moves    = line.split(' '),
        position = new Position(),
        timeout  = 0;
    flipped = moves.length % 2 ? false : true;
    position.draw();
    let lastMove = moves.pop();
    for (let move of moves) {
      let [from, to] = [0, 2].map(i => new Square(move.substr(i, 2)));
      position = new Move(position, from, to).make();
      let pos = new Position(position.FEN);
      setTimeout(() => { pos.draw(); sounds.move.play() }, 400*timeout++);
    }
    expectedMove = new Move(position, ...[0, 2].map(i => new Square(lastMove.substr(i, 2))));
    window.position = position;
  }
}

function main() {
  console.clear();
  draw();
}

piecesSVG.onload = draw;

// https://rosettacode.org/wiki/Modified_random_distribution#JavaScript
function random(m) {
  while (true) {
    let r = Math.random();
    if (Math.random() < m(r))
      return r;
  }
}
  
piecesSVG.src = [
'data:image/svg+xml;base64,',
'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+Cjwh',
'RE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cu',
'dzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+CjxzdmcgeG1sbnM9Imh0dHA6',
'Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIyNzAiIGhlaWdodD0i',
'OTAiPgogICAgPCEtLSB3aGl0ZSBraW5nIC8vLS0+CiAgICA8ZyBzdHlsZT0iZmlsbDpub25lOyBm',
'aWxsLW9wYWNpdHk6MTsgZmlsbC1ydWxlOmV2ZW5vZGQ7IHN0cm9rZTojMDAwMDAwOyBzdHJva2Ut',
'd2lkdGg6MS41OyBzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ry',
'b2tlLW1pdGVybGltaXQ6NDsgc3Ryb2tlLWRhc2hhcnJheTpub25lOyBzdHJva2Utb3BhY2l0eTox',
'OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCwwKSI+CiAgICAgICAgPHBhdGgKICAgICAgICBkPSJN',
'IDIyLjUsMTEuNjMgTCAyMi41LDYiCiAgICAgICAgc3R5bGU9ImZpbGw6bm9uZTsgc3Ryb2tlOiMw',
'MDAwMDA7IHN0cm9rZS1saW5lam9pbjptaXRlcjsiIC8+CiAgICAgICAgPHBhdGgKICAgICAgICBk',
'PSJNIDIwLDggTCAyNSw4IgogICAgICAgIHN0eWxlPSJmaWxsOm5vbmU7IHN0cm9rZTojMDAwMDAw',
'OyBzdHJva2UtbGluZWpvaW46bWl0ZXI7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSAy',
'Mi41LDI1IEMgMjIuNSwyNSAyNywxNy41IDI1LjUsMTQuNSBDIDI1LjUsMTQuNSAyNC41LDEyIDIy',
'LjUsMTIgQyAyMC41LDEyIDE5LjUsMTQuNSAxOS41LDE0LjUgQyAxOCwxNy41IDIyLjUsMjUgMjIu',
'NSwyNSIKICAgICAgICBzdHlsZT0iZmlsbDojZmZmZmZmOyBzdHJva2U6IzAwMDAwMDsgc3Ryb2tl',
'LWxpbmVjYXA6YnV0dDsgc3Ryb2tlLWxpbmVqb2luOm1pdGVyOyIgLz4KICAgICAgICA8cGF0aAog',
'ICAgICAgIGQ9Ik0gMTEuNSwzNyBDIDE3LDQwLjUgMjcsNDAuNSAzMi41LDM3IEwgMzIuNSwzMCBD',
'IDMyLjUsMzAgNDEuNSwyNS41IDM4LjUsMTkuNSBDIDM0LjUsMTMgMjUsMTYgMjIuNSwyMy41IEwg',
'MjIuNSwyNyBMIDIyLjUsMjMuNSBDIDE5LDE2IDkuNSwxMyA2LjUsMTkuNSBDIDMuNSwyNS41IDEx',
'LjUsMjkuNSAxMS41LDI5LjUgTCAxMS41LDM3IHogIgogICAgICAgIHN0eWxlPSJmaWxsOiNmZmZm',
'ZmY7IHN0cm9rZTojMDAwMDAwOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMTEuNSwz',
'MCBDIDE3LDI3IDI3LDI3IDMyLjUsMzAiCiAgICAgICAgc3R5bGU9ImZpbGw6bm9uZTsgc3Ryb2tl',
'OiMwMDAwMDA7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSAxMS41LDMzLjUgQyAxNywz',
'MC41IDI3LDMwLjUgMzIuNSwzMy41IgogICAgICAgIHN0eWxlPSJmaWxsOm5vbmU7IHN0cm9rZToj',
'MDAwMDAwOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMTEuNSwzNyBDIDE3LDM0IDI3',
'LDM0IDMyLjUsMzciCiAgICAgICAgc3R5bGU9ImZpbGw6bm9uZTsgc3Ryb2tlOiMwMDAwMDA7IiAv',
'PgogICAgPC9nPiAgICAKICAgIAogICAgPCEtLSB3aGl0ZSBxdWVlbiAvLy0tPgogICAgPGcgc3R5',
'bGU9Im9wYWNpdHk6MTsgZmlsbDojZmZmZmZmOyBmaWxsLW9wYWNpdHk6MTsgZmlsbC1ydWxlOmV2',
'ZW5vZGQ7IHN0cm9rZTojMDAwMDAwOyBzdHJva2Utd2lkdGg6MS41OyBzdHJva2UtbGluZWNhcDpy',
'b3VuZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6NDsgc3Ryb2tlLWRh',
'c2hhcnJheTpub25lOyBzdHJva2Utb3BhY2l0eToxOyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDUs',
'MCkiPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSA5IDEzIEEgMiAyIDAgMSAxICA1LDEzIEEg',
'MiAyIDAgMSAxICA5IDEzIHoiCiAgICAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEsLTEpIiAv',
'PgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSA5IDEzIEEgMiAyIDAgMSAxICA1LDEzIEEgMiAy',
'IDAgMSAxICA5IDEzIHoiCiAgICAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTUuNSwtNS41KSIg',
'Lz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gOSAxMyBBIDIgMiAwIDEgMSAgNSwxMyBBIDIg',
'MiAwIDEgMSAgOSAxMyB6IgogICAgICAgIHRyYW5zZm9ybT0idHJhbnNsYXRlKDMyLC0xKSIgLz4K',
'ICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gOSAxMyBBIDIgMiAwIDEgMSAgNSwxMyBBIDIgMiAw',
'IDEgMSAgOSAxMyB6IgogICAgICAgIHRyYW5zZm9ybT0idHJhbnNsYXRlKDcsLTQuNSkiIC8+CiAg',
'ICAgICAgPHBhdGgKICAgICAgICBkPSJNIDkgMTMgQSAyIDIgMCAxIDEgIDUsMTMgQSAyIDIgMCAx',
'IDEgIDkgMTMgeiIKICAgICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyNCwtNCkiIC8+CiAgICAg',
'ICAgPHBhdGgKICAgICAgICBkPSJNIDksMjYgQyAxNy41LDI0LjUgMzAsMjQuNSAzNiwyNiBMIDM4',
'LDE0IEwgMzEsMjUgTCAzMSwxMSBMIDI1LjUsMjQuNSBMIDIyLjUsOS41IEwgMTkuNSwyNC41IEwg',
'MTQsMTAuNSBMIDE0LDI1IEwgNywxNCBMIDksMjYgeiAiCiAgICAgICAgc3R5bGU9InN0cm9rZS1s',
'aW5lY2FwOmJ1dHQ7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSA5LDI2IEMgOSwyOCAx',
'MC41LDI4IDExLjUsMzAgQyAxMi41LDMxLjUgMTIuNSwzMSAxMiwzMy41IEMgMTAuNSwzNC41IDEw',
'LjUsMzYgMTAuNSwzNiBDIDksMzcuNSAxMSwzOC41IDExLDM4LjUgQyAxNy41LDM5LjUgMjcuNSwz',
'OS41IDM0LDM4LjUgQyAzNCwzOC41IDM1LjUsMzcuNSAzNCwzNiBDIDM0LDM2IDM0LjUsMzQuNSAz',
'MywzMy41IEMgMzIuNSwzMSAzMi41LDMxLjUgMzMuNSwzMCBDIDM0LjUsMjggMzYsMjggMzYsMjYg',
'QyAyNy41LDI0LjUgMTcuNSwyNC41IDksMjYgeiAiCiAgICAgICAgc3R5bGU9InN0cm9rZS1saW5l',
'Y2FwOmJ1dHQ7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSAxMS41LDMwIEMgMTUsMjkg',
'MzAsMjkgMzMuNSwzMCIKICAgICAgICBzdHlsZT0iZmlsbDpub25lOyIgLz4KICAgICAgICA8cGF0',
'aAogICAgICAgIGQ9Ik0gMTIsMzMuNSBDIDE4LDMyLjUgMjcsMzIuNSAzMywzMy41IgogICAgICAg',
'IHN0eWxlPSJmaWxsOm5vbmU7IiAvPgogICAgPC9nPgogICAgCiAgICA8IS0tIHdoaXRlIGJpc2hv',
'cCAvLy0tPgogICAgPGcgc3R5bGU9Im9wYWNpdHk6MTsgZmlsbDpub25lOyBmaWxsLXJ1bGU6ZXZl',
'bm9kZDsgZmlsbC1vcGFjaXR5OjE7IHN0cm9rZTojMDAwMDAwOyBzdHJva2Utd2lkdGg6MS41OyBz',
'dHJva2UtbGluZWNhcDpyb3VuZDsgc3Ryb2tlLWxpbmVqb2luOnJvdW5kOyBzdHJva2UtbWl0ZXJs',
'aW1pdDo0OyBzdHJva2UtZGFzaGFycmF5Om5vbmU7IHN0cm9rZS1vcGFjaXR5OjE7IiB0cmFuc2Zv',
'cm09InRyYW5zbGF0ZSg5MCwwKSI+CiAgICAgICAgPGcgc3R5bGU9ImZpbGw6I2ZmZmZmZjsgc3Ry',
'b2tlOiMwMDAwMDA7IHN0cm9rZS1saW5lY2FwOmJ1dHQ7Ij4gCiAgICAgICAgICAgIDxwYXRoCiAg',
'ICAgICAgICAgIGQ9Ik0gOSwzNiBDIDEyLjM5LDM1LjAzIDE5LjExLDM2LjQzIDIyLjUsMzQgQyAy',
'NS44OSwzNi40MyAzMi42MSwzNS4wMyAzNiwzNiBDIDM2LDM2IDM3LjY1LDM2LjU0IDM5LDM4IEMg',
'MzguMzIsMzguOTcgMzcuMzUsMzguOTkgMzYsMzguNSBDIDMyLjYxLDM3LjUzIDI1Ljg5LDM4Ljk2',
'IDIyLjUsMzcuNSBDIDE5LjExLDM4Ljk2IDEyLjM5LDM3LjUzIDksMzguNSBDIDcuNjQ2LDM4Ljk5',
'IDYuNjc3LDM4Ljk3IDYsMzggQyA3LjM1NCwzNi4wNiA5LDM2IDksMzYgeiIgLz4KICAgICAgICAg',
'ICAgPHBhdGgKICAgICAgICAgICAgZD0iTSAxNSwzMiBDIDE3LjUsMzQuNSAyNy41LDM0LjUgMzAs',
'MzIgQyAzMC41LDMwLjUgMzAsMzAgMzAsMzAgQyAzMCwyNy41IDI3LjUsMjYgMjcuNSwyNiBDIDMz',
'LDI0LjUgMzMuNSwxNC41IDIyLjUsMTAuNSBDIDExLjUsMTQuNSAxMiwyNC41IDE3LjUsMjYgQyAx',
'Ny41LDI2IDE1LDI3LjUgMTUsMzAgQyAxNSwzMCAxNC41LDMwLjUgMTUsMzIgeiIgLz4KICAgICAg',
'ICAgICAgPHBhdGgKICAgICAgICAgICAgZD0iTSAyNSA4IEEgMi41IDIuNSAwIDEgMSAgMjAsOCBB',
'IDIuNSAyLjUgMCAxIDEgIDI1IDggeiIgLz4KICAgICAgICA8L2c+CiAgICAgICAgPHBhdGgKICAg',
'ICAgICBkPSJNIDE3LjUsMjYgTCAyNy41LDI2IE0gMTUsMzAgTCAzMCwzMCBNIDIyLjUsMTUuNSBM',
'IDIyLjUsMjAuNSBNIDIwLDE4IEwgMjUsMTgiCiAgICAgICAgc3R5bGU9ImZpbGw6bm9uZTsgc3Ry',
'b2tlOiMwMDAwMDA7IHN0cm9rZS1saW5lam9pbjptaXRlcjsiIC8+CiAgICA8L2c+CgogICAgPCEt',
'LSB3aGl0ZSBrbmlnaHQgLy8tLT4KICAgIDxnIHN0eWxlPSJvcGFjaXR5OjE7IGZpbGw6bm9uZTsg',
'ZmlsbC1vcGFjaXR5OjE7IGZpbGwtcnVsZTpldmVub2RkOyBzdHJva2U6IzAwMDAwMDsgc3Ryb2tl',
'LXdpZHRoOjEuNTsgc3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0',
'cm9rZS1taXRlcmxpbWl0OjQ7IHN0cm9rZS1kYXNoYXJyYXk6bm9uZTsgc3Ryb2tlLW9wYWNpdHk6',
'MTsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEzNSwwKSI+CiAgICAgICAgPHBhdGgKICAgICAgICBk',
'PSJNIDIyLDEwIEMgMzIuNSwxMSAzOC41LDE4IDM4LDM5IEwgMTUsMzkgQyAxNSwzMCAyNSwzMi41',
'IDIzLDE4IgogICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7IHN0cm9rZTojMDAwMDAwOyIgLz4K',
'ICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMjQsMTggQyAyNC4zOCwyMC45MSAxOC40NSwyNS4z',
'NyAxNiwyNyBDIDEzLDI5IDEzLjE4LDMxLjM0IDExLDMxIEMgOS45NTgsMzAuMDYgMTIuNDEsMjcu',
'OTYgMTEsMjggQyAxMCwyOCAxMS4xOSwyOS4yMyAxMCwzMCBDIDksMzAgNS45OTcsMzEgNiwyNiBD',
'IDYsMjQgMTIsMTQgMTIsMTQgQyAxMiwxNCAxMy44OSwxMi4xIDE0LDEwLjUgQyAxMy4yNyw5LjUw',
'NiAxMy41LDguNSAxMy41LDcuNSBDIDE0LjUsNi41IDE2LjUsMTAgMTYuNSwxMCBMIDE4LjUsMTAg',
'QyAxOC41LDEwIDE5LjI4LDguMDA4IDIxLDcgQyAyMiw3IDIyLDEwIDIyLDEwIgogICAgICAgIHN0',
'eWxlPSJmaWxsOiNmZmZmZmY7IHN0cm9rZTojMDAwMDAwOyIgLz4KICAgICAgICA8cGF0aAogICAg',
'ICAgIGQ9Ik0gOS41IDI1LjUgQSAwLjUgMC41IDAgMSAxIDguNSwyNS41IEEgMC41IDAuNSAwIDEg',
'MSA5LjUgMjUuNSB6IgogICAgICAgIHN0eWxlPSJmaWxsOiMwMDAwMDA7IHN0cm9rZTojMDAwMDAw',
'OyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMTUgMTUuNSBBIDAuNSAxLjUgMCAxIDEg',
'IDE0LDE1LjUgQSAwLjUgMS41IDAgMSAxICAxNSAxNS41IHoiCiAgICAgICAgdHJhbnNmb3JtPSJt',
'YXRyaXgoMC44NjYsMC41LC0wLjUsMC44NjYsOS42OTMsLTUuMTczKSIKICAgICAgICBzdHlsZT0i',
'ZmlsbDojMDAwMDAwOyBzdHJva2U6IzAwMDAwMDsiIC8+CiAgICA8L2c+CiAgICAKICAgIDwhLS0g',
'd2hpdGUgcm9vayAvLy0tPgogICAgPGcgc3R5bGU9Im9wYWNpdHk6MTsgZmlsbDojZmZmZmZmOyBm',
'aWxsLW9wYWNpdHk6MTsgZmlsbC1ydWxlOmV2ZW5vZGQ7IHN0cm9rZTojMDAwMDAwOyBzdHJva2Ut',
'd2lkdGg6MS41OyBzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ry',
'b2tlLW1pdGVybGltaXQ6NDsgc3Ryb2tlLWRhc2hhcnJheTpub25lOyBzdHJva2Utb3BhY2l0eTox',
'OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTgwLDApIj4KICAgICAgICA8cGF0aAogICAgICAgIGQ9',
'Ik0gOSwzOSBMIDM2LDM5IEwgMzYsMzYgTCA5LDM2IEwgOSwzOSB6ICIKICAgICAgICBzdHlsZT0i',
'c3Ryb2tlLWxpbmVjYXA6YnV0dDsiIC8+CiAgICAgICAgPHBhdGgKICAgICAgICBkPSJNIDEyLDM2',
'IEwgMTIsMzIgTCAzMywzMiBMIDMzLDM2IEwgMTIsMzYgeiAiCiAgICAgICAgc3R5bGU9InN0cm9r',
'ZS1saW5lY2FwOmJ1dHQ7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSAxMSwxNCBMIDEx',
'LDkgTCAxNSw5IEwgMTUsMTEgTCAyMCwxMSBMIDIwLDkgTCAyNSw5IEwgMjUsMTEgTCAzMCwxMSBM',
'IDMwLDkgTCAzNCw5IEwgMzQsMTQiCiAgICAgICAgc3R5bGU9InN0cm9rZS1saW5lY2FwOmJ1dHQ7',
'IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSAzNCwxNCBMIDMxLDE3IEwgMTQsMTcgTCAx',
'MSwxNCIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMzEsMTcgTCAzMSwyOS41IEwgMTQs',
'MjkuNSBMIDE0LDE3IgogICAgICAgIHN0eWxlPSJzdHJva2UtbGluZWNhcDpidXR0OyBzdHJva2Ut',
'bGluZWpvaW46bWl0ZXI7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSAzMSwyOS41IEwg',
'MzIuNSwzMiBMIDEyLjUsMzIgTCAxNCwyOS41IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0i',
'TSAxMSwxNCBMIDM0LDE0IgogICAgICAgIHN0eWxlPSJmaWxsOm5vbmU7IHN0cm9rZTojMDAwMDAw',
'OyBzdHJva2UtbGluZWpvaW46bWl0ZXI7IiAvPgogICAgPC9nPgoKICAgIDwhLS0gd2hpdGUgcGF3',
'biAvLy0tPiAgICAKICAgIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIyNSwwKSI+CiAgICAgICAg',
'PHBhdGgKICAgICAgICBkPSJNIDIyLDkgQyAxOS43OSw5IDE4LDEwLjc5IDE4LDEzIEMgMTgsMTMu',
'ODkgMTguMjksMTQuNzEgMTguNzgsMTUuMzggQyAxNi44MywxNi41IDE1LjUsMTguNTkgMTUuNSwy',
'MSBDIDE1LjUsMjMuMDMgMTYuNDQsMjQuODQgMTcuOTEsMjYuMDMgQyAxNC45MSwyNy4wOSAxMC41',
'LDMxLjU4IDEwLjUsMzkuNSBMIDMzLjUsMzkuNSBDIDMzLjUsMzEuNTggMjkuMDksMjcuMDkgMjYu',
'MDksMjYuMDMgQyAyNy41NiwyNC44NCAyOC41LDIzLjAzIDI4LjUsMjEgQyAyOC41LDE4LjU5IDI3',
'LjE3LDE2LjUgMjUuMjIsMTUuMzggQyAyNS43MSwxNC43MSAyNiwxMy44OSAyNiwxMyBDIDI2LDEw',
'Ljc5IDI0LjIxLDkgMjIsOSB6ICIKICAgICAgICBzdHlsZT0ib3BhY2l0eToxOyBmaWxsOiNmZmZm',
'ZmY7IGZpbGwtb3BhY2l0eToxOyBmaWxsLXJ1bGU6bm9uemVybzsgc3Ryb2tlOiMwMDAwMDA7IHN0',
'cm9rZS13aWR0aDoxLjU7IHN0cm9rZS1saW5lY2FwOnJvdW5kOyBzdHJva2UtbGluZWpvaW46bWl0',
'ZXI7IHN0cm9rZS1taXRlcmxpbWl0OjQ7IHN0cm9rZS1kYXNoYXJyYXk6bm9uZTsgc3Ryb2tlLW9w',
'YWNpdHk6MTsiIC8+CiAgICA8L2c+CiAgICAKICAgIDwhLS0gYmxhY2sga2luZyAvLy0tPgogICAg',
'PGcgc3R5bGU9ImZpbGw6bm9uZTsgZmlsbC1vcGFjaXR5OjE7IGZpbGwtcnVsZTpldmVub2RkOyBz',
'dHJva2U6IzAwMDAwMDsgc3Ryb2tlLXdpZHRoOjEuNTsgc3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ry',
'b2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjQ7IHN0cm9rZS1kYXNoYXJyYXk6',
'bm9uZTsgc3Ryb2tlLW9wYWNpdHk6MTsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAsNDUpIj4KICAg',
'ICAgICA8cGF0aCAKICAgICAgICAgICAgZD0iTSAyMi41LDExLjYzIEwgMjIuNSw2IgogICAgICAg',
'ICAgICBzdHlsZT0iZmlsbDpub25lOyBzdHJva2U6IzAwMDAwMDsgc3Ryb2tlLWxpbmVqb2luOm1p',
'dGVyOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgICAgICBkPSJNIDIyLjUsMjUgQyAyMi41LDI1',
'IDI3LDE3LjUgMjUuNSwxNC41IEMgMjUuNSwxNC41IDI0LjUsMTIgMjIuNSwxMiBDIDIwLjUsMTIg',
'MTkuNSwxNC41IDE5LjUsMTQuNSBDIDE4LDE3LjUgMjIuNSwyNSAyMi41LDI1IiAKICAgICAgICAg',
'ICAgc3R5bGU9ImZpbGw6IzAwMDAwMDtmaWxsLW9wYWNpdHk6MTsgc3Ryb2tlLWxpbmVjYXA6YnV0',
'dDsgc3Ryb2tlLWxpbmVqb2luOm1pdGVyOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgICAgIGQ9',
'Ik0gMTEuNSwzNyBDIDE3LDQwLjUgMjcsNDAuNSAzMi41LDM3IEwgMzIuNSwzMCBDIDMyLjUsMzAg',
'NDEuNSwyNS41IDM4LjUsMTkuNSBDIDM0LjUsMTMgMjUsMTYgMjIuNSwyMy41IEwgMjIuNSwyNyBM',
'IDIyLjUsMjMuNSBDIDE5LDE2IDkuNSwxMyA2LjUsMTkuNSBDIDMuNSwyNS41IDExLjUsMjkuNSAx',
'MS41LDI5LjUgTCAxMS41LDM3IHogIgogICAgICAgICAgIHN0eWxlPSJmaWxsOiMwMDAwMDA7IHN0',
'cm9rZTojMDAwMDAwOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgICAgIGQ9Ik0gMjAsOCBMIDI1',
'LDgiCiAgICAgICAgICAgc3R5bGU9ImZpbGw6bm9uZTsgc3Ryb2tlOiMwMDAwMDA7IHN0cm9rZS1s',
'aW5lam9pbjptaXRlcjsiIC8+CiAgICAgICAgPHBhdGgKICAgICAgICAgICBkPSJNIDMyLDI5LjUg',
'QyAzMiwyOS41IDQwLjUsMjUuNSAzOC4wMywxOS44NSBDIDM0LjE1LDE0IDI1LDE4IDIyLjUsMjQu',
'NSBMIDIyLjUxLDI2LjYgTCAyMi41LDI0LjUgQyAyMCwxOCA5LjkwNiwxNCA2Ljk5NywxOS44NSBD',
'IDQuNSwyNS41IDExLjg1LDI4Ljg1IDExLjg1LDI4Ljg1IgogICAgICAgICAgIHN0eWxlPSJmaWxs',
'Om5vbmU7IHN0cm9rZTojZmZmZmZmOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgICAgIGQ9Ik0g',
'MTEuNSwzMCBDIDE3LDI3IDI3LDI3IDMyLjUsMzAgTSAxMS41LDMzLjUgQyAxNywzMC41IDI3LDMw',
'LjUgMzIuNSwzMy41IE0gMTEuNSwzNyBDIDE3LDM0IDI3LDM0IDMyLjUsMzciCiAgICAgICAgICAg',
'c3R5bGU9ImZpbGw6bm9uZTsgc3Ryb2tlOiNmZmZmZmY7IiAvPgogICAgPC9nPgogICAgCiAgICA8',
'IS0tIGJsYWNrIHF1ZWVuIC8vLS0+CiAgICA8ZyBzdHlsZT0ib3BhY2l0eToxOyBmaWxsOjAwMDAw',
'MDsgZmlsbC1vcGFjaXR5OjE7IGZpbGwtcnVsZTpldmVub2RkOyBzdHJva2U6IzAwMDAwMDsgc3Ry',
'b2tlLXdpZHRoOjEuNTsgc3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5k',
'O3N0cm9rZS1taXRlcmxpbWl0OjQ7IHN0cm9rZS1kYXNoYXJyYXk6bm9uZTsgc3Ryb2tlLW9wYWNp',
'dHk6MTsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQ1LDQ1KSI+CiAgICAgICAgPGcgc3R5bGU9ImZp',
'bGw6IzAwMDAwMDsgc3Ryb2tlOm5vbmU7Ij4KICAgICAgICAgICAgPGNpcmNsZSBjeD0iNiIgICAg',
'Y3k9IjEyIiByPSIyLjc1IiAvPgogICAgICAgICAgICA8Y2lyY2xlIGN4PSIxNCIgICBjeT0iOSIg',
'IHI9IjIuNzUiIC8+CiAgICAgICAgICAgIDxjaXJjbGUgY3g9IjIyLjUiIGN5PSI4IiAgcj0iMi43',
'NSIgLz4KICAgICAgICAgICAgPGNpcmNsZSBjeD0iMzEiICAgY3k9IjkiICByPSIyLjc1IiAvPgog',
'ICAgICAgICAgICA8Y2lyY2xlIGN4PSIzOSIgICBjeT0iMTIiIHI9IjIuNzUiIC8+CiAgICAgICAg',
'PC9nPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSA5LDI2IEMgMTcuNSwyNC41IDMwLDI0LjUg',
'MzYsMjYgTCAzOC41LDEzLjUgTCAzMSwyNSBMIDMwLjcsMTAuOSBMIDI1LjUsMjQuNSBMIDIyLjUs',
'MTAgTCAxOS41LDI0LjUgTCAxNC4zLDEwLjkgTCAxNCwyNSBMIDYuNSwxMy41IEwgOSwyNiB6Igog',
'ICAgICAgIHN0eWxlPSJzdHJva2UtbGluZWNhcDpidXR0OyBzdHJva2U6IzAwMDAwMDsiIC8+CiAg',
'ICAgICAgPHBhdGgKICAgICAgICBkPSJNIDksMjYgQyA5LDI4IDEwLjUsMjggMTEuNSwzMCBDIDEy',
'LjUsMzEuNSAxMi41LDMxIDEyLDMzLjUgQyAxMC41LDM0LjUgMTAuNSwzNiAxMC41LDM2IEMgOSwz',
'Ny41IDExLDM4LjUgMTEsMzguNSBDIDE3LjUsMzkuNSAyNy41LDM5LjUgMzQsMzguNSBDIDM0LDM4',
'LjUgMzUuNSwzNy41IDM0LDM2IEMgMzQsMzYgMzQuNSwzNC41IDMzLDMzLjUgQyAzMi41LDMxIDMy',
'LjUsMzEuNSAzMy41LDMwIEMgMzQuNSwyOCAzNiwyOCAzNiwyNiBDIDI3LjUsMjQuNSAxNy41LDI0',
'LjUgOSwyNiB6IgogICAgICAgIHN0eWxlPSJzdHJva2UtbGluZWNhcDpidXR0OyIgLz4KICAgICAg',
'ICA8cGF0aAogICAgICAgIGQ9Ik0gMTEsMzguNSBBIDM1LDM1IDEgMCAwIDM0LDM4LjUiCiAgICAg',
'ICAgc3R5bGU9ImZpbGw6bm9uZTsgc3Ryb2tlOiMwMDAwMDA7IHN0cm9rZS1saW5lY2FwOmJ1dHQ7',
'IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgZD0iTSAxMSwyOSBBIDM1LDM1IDEgMCAxIDM0LDI5',
'IgogICAgICAgIHN0eWxlPSJmaWxsOm5vbmU7IHN0cm9rZTojZmZmZmZmOyIgLz4KICAgICAgICA8',
'cGF0aAogICAgICAgIGQ9Ik0gMTIuNSwzMS41IEwgMzIuNSwzMS41IgogICAgICAgIHN0eWxlPSJm',
'aWxsOm5vbmU7IHN0cm9rZTojZmZmZmZmOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0g',
'MTEuNSwzNC41IEEgMzUsMzUgMSAwIDAgMzMuNSwzNC41IgogICAgICAgIHN0eWxlPSJmaWxsOm5v',
'bmU7IHN0cm9rZTojZmZmZmZmOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMTAuNSwz',
'Ny41IEEgMzUsMzUgMSAwIDAgMzQuNSwzNy41IgogICAgICAgIHN0eWxlPSJmaWxsOm5vbmU7IHN0',
'cm9rZTojZmZmZmZmOyIgLz4KICAgIDwvZz4KICAgICAKICAgIDwhLS0gYmxhY2sgYmlzaG9wIC8v',
'LS0+CiAgICA8ZyBzdHlsZT0ib3BhY2l0eToxOyBmaWxsOm5vbmU7IGZpbGwtcnVsZTpldmVub2Rk',
'OyBmaWxsLW9wYWNpdHk6MTsgc3Ryb2tlOiMwMDAwMDA7IHN0cm9rZS13aWR0aDoxLjU7IHN0cm9r',
'ZS1saW5lY2FwOnJvdW5kOyBzdHJva2UtbGluZWpvaW46cm91bmQ7IHN0cm9rZS1taXRlcmxpbWl0',
'OjQ7IHN0cm9rZS1kYXNoYXJyYXk6bm9uZTsgc3Ryb2tlLW9wYWNpdHk6MTsiIHRyYW5zZm9ybT0i',
'dHJhbnNsYXRlKDkwLDQ1KSI+CiAgICAgICAgPGcgc3R5bGU9ImZpbGw6IzAwMDAwMDsgc3Ryb2tl',
'OiMwMDAwMDA7IHN0cm9rZS1saW5lY2FwOmJ1dHQ7Ij4gCiAgICAgICAgICAgIDxwYXRoCiAgICAg',
'ICAgICAgICAgICBkPSJNIDksMzYgQyAxMi4zOSwzNS4wMyAxOS4xMSwzNi40MyAyMi41LDM0IEMg',
'MjUuODksMzYuNDMgMzIuNjEsMzUuMDMgMzYsMzYgQyAzNiwzNiAzNy42NSwzNi41NCAzOSwzOCBD',
'IDM4LjMyLDM4Ljk3IDM3LjM1LDM4Ljk5IDM2LDM4LjUgQyAzMi42MSwzNy41MyAyNS44OSwzOC45',
'NiAyMi41LDM3LjUgQyAxOS4xMSwzOC45NiAxMi4zOSwzNy41MyA5LDM4LjUgQyA3LjY0NiwzOC45',
'OSA2LjY3NywzOC45NyA2LDM4IEMgNy4zNTQsMzYuMDYgOSwzNiA5LDM2IHoiIC8+CiAgICAgICAg',
'ICAgIDxwYXRoCiAgICAgICAgICAgICAgICBkPSJNIDE1LDMyIEMgMTcuNSwzNC41IDI3LjUsMzQu',
'NSAzMCwzMiBDIDMwLjUsMzAuNSAzMCwzMCAzMCwzMCBDIDMwLDI3LjUgMjcuNSwyNiAyNy41LDI2',
'IEMgMzMsMjQuNSAzMy41LDE0LjUgMjIuNSwxMC41IEMgMTEuNSwxNC41IDEyLDI0LjUgMTcuNSwy',
'NiBDIDE3LjUsMjYgMTUsMjcuNSAxNSwzMCBDIDE1LDMwIDE0LjUsMzAuNSAxNSwzMiB6IiAvPgog',
'ICAgICAgICAgICA8cGF0aAogICAgICAgICAgICAgICAgZD0iTSAyNSA4IEEgMi41IDIuNSAwIDEg',
'MSAgMjAsOCBBIDIuNSAyLjUgMCAxIDEgIDI1IDggeiIgLz4KICAgICAgICA8L2c+CiAgICAgICAg',
'PHBhdGgKICAgICAgICAgICBkPSJNIDE3LjUsMjYgTCAyNy41LDI2IE0gMTUsMzAgTCAzMCwzMCBN',
'IDIyLjUsMTUuNSBMIDIyLjUsMjAuNSBNIDIwLDE4IEwgMjUsMTgiCiAgICAgICAgICAgc3R5bGU9',
'ImZpbGw6bm9uZTsgc3Ryb2tlOiNmZmZmZmY7IHN0cm9rZS1saW5lam9pbjptaXRlcjsiIC8+CiAg',
'ICA8L2c+CiAgICAKICAgIDwhLS0gYmxhY2sga25pZ2h0IC8vLS0+CiAgICA8ZyBzdHlsZT0ib3Bh',
'Y2l0eToxOyBmaWxsOm5vbmU7IGZpbGwtb3BhY2l0eToxOyBmaWxsLXJ1bGU6ZXZlbm9kZDsgc3Ry',
'b2tlOiMwMDAwMDA7IHN0cm9rZS13aWR0aDoxLjU7IHN0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9r',
'ZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo0OyBzdHJva2UtZGFzaGFycmF5Om5v',
'bmU7IHN0cm9rZS1vcGFjaXR5OjE7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMzUsNDUpIj4KICAg',
'ICAgICA8cGF0aAogICAgICAgICAgIGQ9Ik0gMjIsMTAgQyAzMi41LDExIDM4LjUsMTggMzgsMzkg',
'TCAxNSwzOSBDIDE1LDMwIDI1LDMyLjUgMjMsMTgiCiAgICAgICAgICAgc3R5bGU9ImZpbGw6IzAw',
'MDAwMDsgc3Ryb2tlOiMwMDAwMDA7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgICAgZD0iTSAy',
'NCwxOCBDIDI0LjM4LDIwLjkxIDE4LjQ1LDI1LjM3IDE2LDI3IEMgMTMsMjkgMTMuMTgsMzEuMzQg',
'MTEsMzEgQyA5Ljk1OCwzMC4wNiAxMi40MSwyNy45NiAxMSwyOCBDIDEwLDI4IDExLjE5LDI5LjIz',
'IDEwLDMwIEMgOSwzMCA1Ljk5NywzMSA2LDI2IEMgNiwyNCAxMiwxNCAxMiwxNCBDIDEyLDE0IDEz',
'Ljg5LDEyLjEgMTQsMTAuNSBDIDEzLjI3LDkuNTA2IDEzLjUsOC41IDEzLjUsNy41IEMgMTQuNSw2',
'LjUgMTYuNSwxMCAxNi41LDEwIEwgMTguNSwxMCBDIDE4LjUsMTAgMTkuMjgsOC4wMDggMjEsNyBD',
'IDIyLDcgMjIsMTAgMjIsMTAiCiAgICAgICAgICAgc3R5bGU9ImZpbGw6IzAwMDAwMDsgc3Ryb2tl',
'OiMwMDAwMDA7IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgICAgZD0iTSA5LjUgMjUuNSBBIDAu',
'NSAwLjUgMCAxIDEgOC41LDI1LjUgQSAwLjUgMC41IDAgMSAxIDkuNSAyNS41IHoiCiAgICAgICAg',
'ICAgc3R5bGU9ImZpbGw6I2ZmZmZmZjsgc3Ryb2tlOiNmZmZmZmY7IiAvPgogICAgICAgIDxwYXRo',
'CiAgICAgICAgICAgZD0iTSAxNSAxNS41IEEgMC41IDEuNSAwIDEgMSAgMTQsMTUuNSBBIDAuNSAx',
'LjUgMCAxIDEgIDE1IDE1LjUgeiIKICAgICAgICAgICB0cmFuc2Zvcm09Im1hdHJpeCgwLjg2Niww',
'LjUsLTAuNSwwLjg2Niw5LjY5MywtNS4xNzMpIgogICAgICAgICAgIHN0eWxlPSJmaWxsOiNmZmZm',
'ZmY7IHN0cm9rZTojZmZmZmZmOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgICAgIGQ9Ik0gMjQu',
'NTUsMTAuNCBMIDI0LjEsMTEuODUgTCAyNC42LDEyIEMgMjcuNzUsMTMgMzAuMjUsMTQuNDkgMzIu',
'NSwxOC43NSBDIDM0Ljc1LDIzLjAxIDM1Ljc1LDI5LjA2IDM1LjI1LDM5IEwgMzUuMiwzOS41IEwg',
'MzcuNDUsMzkuNSBMIDM3LjUsMzkgQyAzOCwyOC45NCAzNi42MiwyMi4xNSAzNC4yNSwxNy42NiBD',
'IDMxLjg4LDEzLjE3IDI4LjQ2LDExLjAyIDI1LjA2LDEwLjUgTCAyNC41NSwxMC40IHogIgogICAg',
'ICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7IHN0cm9rZTpub25lOyIgLz4KICAgIDwvZz4KICAg',
'IAogICAgPCEtLSBibGFjayByb29rIC8vLS0+CiAgICA8ZyBzdHlsZT0ib3BhY2l0eToxOyBmaWxs',
'OjAwMDAwMDsgZmlsbC1vcGFjaXR5OjE7IGZpbGwtcnVsZTpldmVub2RkOyBzdHJva2U6IzAwMDAw',
'MDsgc3Ryb2tlLXdpZHRoOjEuNTsgc3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2lu',
'OnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjQ7IHN0cm9rZS1kYXNoYXJyYXk6bm9uZTsgc3Ryb2tl',
'LW9wYWNpdHk6MTsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE4MCw0NSkiPgogICAgICAgIDxwYXRo',
'CiAgICAgICAgZD0iTSA5LDM5IEwgMzYsMzkgTCAzNiwzNiBMIDksMzYgTCA5LDM5IHogIgogICAg',
'ICAgIHN0eWxlPSJzdHJva2UtbGluZWNhcDpidXR0OyIgLz4KICAgICAgICA8cGF0aAogICAgICAg',
'IGQ9Ik0gMTIuNSwzMiBMIDE0LDI5LjUgTCAzMSwyOS41IEwgMzIuNSwzMiBMIDEyLjUsMzIgeiAi',
'CiAgICAgICAgc3R5bGU9InN0cm9rZS1saW5lY2FwOmJ1dHQ7IiAvPgogICAgICAgIDxwYXRoCiAg',
'ICAgICAgZD0iTSAxMiwzNiBMIDEyLDMyIEwgMzMsMzIgTCAzMywzNiBMIDEyLDM2IHogIgogICAg',
'ICAgIHN0eWxlPSJzdHJva2UtbGluZWNhcDpidXR0OyIgLz4KICAgICAgICA8cGF0aAogICAgICAg',
'IGQ9Ik0gMTQsMjkuNSBMIDE0LDE2LjUgTCAzMSwxNi41IEwgMzEsMjkuNSBMIDE0LDI5LjUgeiAi',
'CiAgICAgICAgc3R5bGU9InN0cm9rZS1saW5lY2FwOmJ1dHQ7c3Ryb2tlLWxpbmVqb2luOm1pdGVy',
'OyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMTQsMTYuNSBMIDExLDE0IEwgMzQsMTQg',
'TCAzMSwxNi41IEwgMTQsMTYuNSB6ICIKICAgICAgICBzdHlsZT0ic3Ryb2tlLWxpbmVjYXA6YnV0',
'dDsiIC8+CiAgICAgICAgPHBhdGgKICAgICAgICBkPSJNIDExLDE0IEwgMTEsOSBMIDE1LDkgTCAx',
'NSwxMSBMIDIwLDExIEwgMjAsOSBMIDI1LDkgTCAyNSwxMSBMIDMwLDExIEwgMzAsOSBMIDM0LDkg',
'TCAzNCwxNCBMIDExLDE0IHogIgogICAgICAgIHN0eWxlPSJzdHJva2UtbGluZWNhcDpidXR0OyIg',
'Lz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMTIsMzUuNSBMIDMzLDM1LjUgTCAzMywzNS41',
'IgogICAgICAgIHN0eWxlPSJmaWxsOm5vbmU7IHN0cm9rZTojZmZmZmZmOyBzdHJva2Utd2lkdGg6',
'MTsgc3Ryb2tlLWxpbmVqb2luOm1pdGVyOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0g',
'MTMsMzEuNSBMIDMyLDMxLjUiCiAgICAgICAgc3R5bGU9ImZpbGw6bm9uZTsgc3Ryb2tlOiNmZmZm',
'ZmY7IHN0cm9rZS13aWR0aDoxOyBzdHJva2UtbGluZWpvaW46bWl0ZXI7IiAvPgogICAgICAgIDxw',
'YXRoCiAgICAgICAgZD0iTSAxNCwyOS41IEwgMzEsMjkuNSIKICAgICAgICBzdHlsZT0iZmlsbDpu',
'b25lOyBzdHJva2U6I2ZmZmZmZjsgc3Ryb2tlLXdpZHRoOjE7IHN0cm9rZS1saW5lam9pbjptaXRl',
'cjsiIC8+CiAgICAgICAgPHBhdGgKICAgICAgICBkPSJNIDE0LDE2LjUgTCAzMSwxNi41IgogICAg',
'ICAgIHN0eWxlPSJmaWxsOm5vbmU7IHN0cm9rZTojZmZmZmZmOyBzdHJva2Utd2lkdGg6MTsgc3Ry',
'b2tlLWxpbmVqb2luOm1pdGVyOyIgLz4KICAgICAgICA8cGF0aAogICAgICAgIGQ9Ik0gMTEsMTQg',
'TCAzNCwxNCIKICAgICAgICBzdHlsZT0iZmlsbDpub25lOyBzdHJva2U6I2ZmZmZmZjsgc3Ryb2tl',
'LXdpZHRoOjE7IHN0cm9rZS1saW5lam9pbjptaXRlcjsiIC8+CiAgICA8L2c+CiAgICAKICAgIDwh',
'LS0gYmxhY2sgcGF3biAvLy0tPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjI1LDQ1KSI+',
'CiAgICAgICAgPHBhdGgKICAgICAgICBkPSJNIDIyLDkgQyAxOS43OSw5IDE4LDEwLjc5IDE4LDEz',
'IEMgMTgsMTMuODkgMTguMjksMTQuNzEgMTguNzgsMTUuMzggQyAxNi44MywxNi41IDE1LjUsMTgu',
'NTkgMTUuNSwyMSBDIDE1LjUsMjMuMDMgMTYuNDQsMjQuODQgMTcuOTEsMjYuMDMgQyAxNC45MSwy',
'Ny4wOSAxMC41LDMxLjU4IDEwLjUsMzkuNSBMIDMzLjUsMzkuNSBDIDMzLjUsMzEuNTggMjkuMDks',
'MjcuMDkgMjYuMDksMjYuMDMgQyAyNy41NiwyNC44NCAyOC41LDIzLjAzIDI4LjUsMjEgQyAyOC41',
'LDE4LjU5IDI3LjE3LDE2LjUgMjUuMjIsMTUuMzggQyAyNS43MSwxNC43MSAyNiwxMy44OSAyNiwx',
'MyBDIDI2LDEwLjc5IDI0LjIxLDkgMjIsOSB6ICIKICAgICAgICBzdHlsZT0ib3BhY2l0eToxOyBm',
'aWxsOiMwMDAwMDA7IGZpbGwtb3BhY2l0eToxOyBmaWxsLXJ1bGU6bm9uemVybzsgc3Ryb2tlOiMw',
'MDAwMDA7IHN0cm9rZS13aWR0aDoxLjU7IHN0cm9rZS1saW5lY2FwOnJvdW5kOyBzdHJva2UtbGlu',
'ZWpvaW46bWl0ZXI7IHN0cm9rZS1taXRlcmxpbWl0OjQ7IHN0cm9rZS1kYXNoYXJyYXk6bm9uZTsg',
'c3Ryb2tlLW9wYWNpdHk6MTsiIC8+CiAgICA8L2c+Cjwvc3ZnPg=='
].join('');

sounds.move.src = [
'data:audio/ogg;base64,',
'T2dnUwACAAAAAAAAAAB9NAAAAAAAAH0EBtIBHgF2b3JiaXMAAAAAAUSsAAAAAAAAAHcBAAAAAAC4',
'AU9nZ1MAAAAAAAAAAAAAfTQAAAEAAABZf9NuEJ///////////////////8kDdm9yYmlzKwAAAFhp',
'cGguT3JnIGxpYlZvcmJpcyBJIDIwMTIwMjAzIChPbW5pcHJlc2VudCkDAAAAHgAAAFRJVExFPVdv',
'b2RlbiBwaWVjZSAtIHNoYXJwIGhpdCcAAABDb3B5cmlnaHQ9Q29weXJpZ2h0IDIwMDAsIFNvdW5k',
'ZG9ncy5jb20TAAAAU29mdHdhcmU9QXdDKysgdjIuMQEFdm9yYmlzKUJDVgEACAAAADFMIMWA0JBV',
'AAAQAABgJCkOk2ZJKaWUoSh5mJRISSmllMUwiZiUicUYY4wxxhhjjDHGGGOMIDRkFQAABACAKAmO',
'o+ZJas45ZxgnjnKgOWlOOKcgB4pR4DkJwvUmY26mtKZrbs4pJQgNWQUAAAIAQEghhRRSSCGFFGKI',
'IYYYYoghhxxyyCGnnHIKKqigggoyyCCDTDLppJNOOumoo4466ii00EILLbTSSkwx1VZjrr0GXXxz',
'zjnnnHPOOeecc84JQkNWAQAgAAAEQgYZZBBCCCGFFFKIKaaYcgoyyIDQkFUAACAAgAAAAABHkRRJ',
'sRTLsRzN0SRP8ixREzXRM0VTVE1VVVVVdV1XdmXXdnXXdn1ZmIVbuH1ZuIVb2IVd94VhGIZhGIZh',
'GIZh+H3f933f930gNGQVACABAKAjOZbjKaIiGqLiOaIDhIasAgBkAAAEACAJkiIpkqNJpmZqrmmb',
'tmirtm3LsizLsgyEhqwCAAABAAQAAAAAAKBpmqZpmqZpmqZpmqZpmqZpmqZpmmZZlmVZlmVZlmVZ',
'lmVZlmVZlmVZlmVZlmVZlmVZlmVZlmVZlmVZQGjIKgBAAgBAx3Ecx3EkRVIkx3IsBwgNWQUAyAAA',
'CABAUizFcjRHczTHczzHczxHdETJlEzN9EwPCA1ZBQAAAgAIAAAAAABAMRzFcRzJ0SRPUi3TcjVX',
'cz3Xc03XdV1XVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVYHQkFUAAAQAACGdZpZq',
'gAgzkGEgNGQVAIAAAAAYoQhDDAgNWQUAAAQAAIih5CCa0JrzzTkOmuWgqRSb08GJVJsnuamYm3PO',
'OeecbM4Z45xzzinKmcWgmdCac85JDJqloJnQmnPOeRKbB62p0ppzzhnnnA7GGWGcc85p0poHqdlY',
'm3POWdCa5qi5FJtzzomUmye1uVSbc84555xzzjnnnHPOqV6czsE54Zxzzonam2u5CV2cc875ZJzu',
'zQnhnHPOOeecc84555xzzglCQ1YBAEAAAARh2BjGnYIgfY4GYhQhpiGTHnSPDpOgMcgppB6NjkZK',
'qYNQUhknpXSC0JBVAAAgAACEEFJIIYUUUkghhRRSSCGGGGKIIaeccgoqqKSSiirKKLPMMssss8wy',
'y6zDzjrrsMMQQwwxtNJKLDXVVmONteaec645SGultdZaK6WUUkoppSA0ZBUAAAIAQCBkkEEGGYUU',
'UkghhphyyimnoIIKCA1ZBQAAAgAIAAAA8CTPER3RER3RER3RER3RER3P8RxREiVREiXRMi1TMz1V',
'VFVXdm1Zl3Xbt4Vd2HXf133f141fF4ZlWZZlWZZlWZZlWZZlWZZlCUJDVgEAIAAAAEIIIYQUUkgh',
'hZRijDHHnINOQgmB0JBVAAAgAIAAAAAAR3EUx5EcyZEkS7IkTdIszfI0T/M00RNFUTRNUxVd0RV1',
'0xZlUzZd0zVl01Vl1XZl2bZlW7d9WbZ93/d93/d93/d93/d939d1IDRkFQAgAQCgIzmSIimSIjmO',
'40iSBISGrAIAZAAABACgKI7iOI4jSZIkWZImeZZniZqpmZ7pqaIKhIasAgAAAQAEAAAAAACgaIqn',
'mIqniIrniI4oiZZpiZqquaJsyq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7rukBo',
'yCoAQAIAQEdyJEdyJEVSJEVyJAcIDVkFAMgAAAgAwDEcQ1Ikx7IsTfM0T/M00RM90TM9VXRFFwgN',
'WQUAAAIACAAAAAAAwJAMS7EczdEkUVIt1VI11VItVVQ9VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
'VVVVVVVVVVVV1TRN0zSB0JCVAAAZAAAjQQYZhBCKcpBCbj1YCDHmJAWhOQahxBiEpxAzDDkNInSQ',
'QSc9uJI5wwzz4FIoFURMg40lN44gDcKmXEnlOAhCQ1YEAFEAAIAxyDHEGHLOScmgRM4xCZ2UyDkn',
'pZPSSSktlhgzKSWmEmPjnKPSScmklBhLip2kEmOJrQAAgAAHAIAAC6HQkBUBQBQAAGIMUgophZRS',
'zinmkFLKMeUcUko5p5xTzjkIHYTKMQadgxAppRxTzinHHITMQeWcg9BBKAAAIMABACDAQig0ZEUA',
'ECcA4HAkz5M0SxQlSxNFzxRl1xNN15U0zTQ1UVRVyxNV1VRV2xZNVbYlTRNNTfRUVRNFVRVV05ZN',
'VbVtzzRl2VRV3RZV1bZl2xZ+V5Z13zNNWRZV1dZNVbV115Z9X9ZtXZg0zTQ1UVRVTRRV1VRV2zZV',
'17Y1UXRVUVVlWVRVWXZlWfdVV9Z9SxRV1VNN2RVVVbZV2fVtVZZ94XRVXVdl2fdVWRZ+W9eF4fZ9',
'4RhV1dZN19V1VZZ9YdZlYbd13yhpmmlqoqiqmiiqqqmqtm2qrq1bouiqoqrKsmeqrqzKsq+rrmzr',
'miiqrqiqsiyqqiyrsqz7qizrtqiquq3KsrCbrqvrtu8LwyzrunCqrq6rsuz7qizruq3rxnHrujB8',
'pinLpqvquqm6um7runHMtm0co6rqvirLwrDKsu/rui+0dSFRVXXdlF3jV2VZ921fd55b94WybTu/',
'rfvKceu60vg5z28cubZtHLNuG7+t+8bzKz9hOI6lZ5q2baqqrZuqq+uybivDrOtCUVV9XZVl3zdd',
'WRdu3zeOW9eNoqrquirLvrDKsjHcxm8cuzAcXds2jlvXnbKtC31jyPcJz2vbxnH7OuP2daOvDAnH',
'jwAAgAEHAIAAE8pAoSErAoA4AQAGIecUUxAqxSB0EFLqIKRUMQYhc05KxRyUUEpqIZTUKsYgVI5J',
'yJyTEkpoKZTSUgehpVBKa6GU1lJrsabUYu0gpBZKaS2U0lpqqcbUWowRYxAy56RkzkkJpbQWSmkt',
'c05K56CkDkJKpaQUS0otVsxJyaCj0kFIqaQSU0mptVBKa6WkFktKMbYUW24x1hxKaS2kEltJKcYU',
'U20txpojxiBkzknJnJMSSmktlNJa5ZiUDkJKmYOSSkqtlZJSzJyT0kFIqYOOSkkptpJKTKGU1kpK',
'sYVSWmwx1pxSbDWU0lpJKcaSSmwtxlpbTLV1EFoLpbQWSmmttVZraq3GUEprJaUYS0qxtRZrbjHm',
'GkppraQSW0mpxRZbji3GmlNrNabWam4x5hpbbT3WmnNKrdbUUo0txppjbb3VmnvvIKQWSmktlNJi',
'ai3G1mKtoZTWSiqxlZJabDHm2lqMOZTSYkmpxZJSjC3GmltsuaaWamwx5ppSi7Xm2nNsNfbUWqwt',
'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'
].join('');
