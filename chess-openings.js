"use strict";

const SECOND = 1,
  MINUTE = 60*SECOND,
  HOUR   = 60*MINUTE,
  DAY    = 24*HOUR,
  WEEK   = 7*DAY,
  MONTH  = 28*DAY,
  YEAR   = 12*MONTH,

  TIME_INTERVALS = [
    MINUTE, 10*MINUTE,
    HOUR,   5*HOUR,
    DAY,    5*DAY,
    MONTH,  3*MONTH,
    YEAR,   2*YEAR
  ],

  LANG = 'en-US';

fetch("chess/repertoire.json")
  .then(response => response.json())
  .then(main);

function $(x) { return document.getElementById(x); }
function addElement(tag, innerHTML) {
  let element = document.createElement(tag);
  document.body.appendChild(element);
  if (innerHTML) element.innerHTML = innerHTML;
  return element;
}

function main(json) {

  if (typeof sessionStorage === "undefined") {
    let p = addElement('p');
    p.innerHTML = "Your browser does not support <a href=https://www.w3schools.com/html/html5_webstorage.asp>HTML5 Web storage</a> :( .";
    return;
  }
  
  let position = new Position(),
    repertoire = json,
    move_history = [],
    sounds = {
      move:    document.getElementById("movesound"),
      capture: document.getElementById("capture"),
      silence: document.getElementById("silence")
    },
    board = Chessboard(
      'myBoard',
      {
        draggable: true,
        position: position.fen,
        onDragStart: function (source, piece, pos, orientation) {
          // only pick up pieces for the side to move
          if ((position.turn === 'w' && piece.search(/^b/) !== -1) ||
            (position.turn === 'b' && piece.search(/^w/) !== -1)) {
            return false
          }
        },
        onDrop: function (source, target) {
          let capture = position.board[SQUARES[target]] ? true : false,
            move = source+target;
          try { position = position.make_move(move); }
          catch (err) { 
            if (err === ERRORS[12]) { say("check!"); }
            else console.log(err.message);
            return 'snapback';
          }
          move_history.push(move);
          $log.value = '';
          if (position.last_move) $log.value = position.last_move;
          //$log.innerHTML += position.fen;
          if (/0-0|ep/.test(position.last_move))
            board.position(position.fen, false);
          if (capture) sounds.capture.play();
          else sounds.move.play();
          new Promise((resolve, reject) => position.checked ? resolve("check") : reject("no check"))
            .then(say);
        }
      }
    ),
    $log = $("log"),
    $flip = addElement("button", "flip"),
    $restart = addElement("button", "restart"),
    $add = addElement("button", "add");

  $flip.addEventListener("click", () => board.flip()),
  $restart.addEventListener(
    "click",
    () => {
      position = new Position();
      board.start();
      move_history = [];
    }
  );
  $add.addEventListener(
    "click",
    function () {
      let key = board.orientation(":") + move_history.join(',');
      if (sessionStorage[key]) {
        let json = JSON.parse(sessionStorage[key]);
        console.log("This opening was already added on " + new Date(json.last_learned));
      } else {
        say(new Game({}, ...move_history).opening);
        sessionStorage[key] = JSON.stringify(
          { last_learned: Date.now(), successes: 0 }
        );
        console.log(sessionStorage[key]);
      }
    }
  );

}

function clone(thing) {
  if (typeof(thing) == 'object') {
    let $ = {};
    for (let key in thing) 
      $[key] = clone(thing[key]);
    return $;
  } else return thing;
}

function say(text) {
  if ('speechSynthesis' in window) {
    let speech = new SpeechSynthesisUtterance(text);
    speech.lang = LANG;
    window.speechSynthesis.speak(speech);
  }
}
