var _____WB$wombat$assign$function_____ = function(name) {return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name)) || self[name]; };
if (!self.__WB_pmw) { self.__WB_pmw = function(obj) { this.__WB_source = obj; return this; } }
{
  let window = _____WB$wombat$assign$function_____("window");
  let self = _____WB$wombat$assign$function_____("self");
  let document = _____WB$wombat$assign$function_____("document");
  let location = _____WB$wombat$assign$function_____("location");
  let top = _____WB$wombat$assign$function_____("top");
  let parent = _____WB$wombat$assign$function_____("parent");
  let frames = _____WB$wombat$assign$function_____("frames");
  let opener = _____WB$wombat$assign$function_____("opener");

function Chessy(cfg) {
	this.board = new ChessBoard('board', cfg);
	this.game = new Chess();
}

Chessy.prototype.orientation = function() {
	return this.board.orientation();
};

Chessy.prototype.move = function(nextMove) {
	var move_obj = this.game.move(nextMove);
	
	$('.square-55d63.highlightLastMove').removeClass('highlightLastMove');
	$('.square-' + move_obj.from).addClass('highlightLastMove');
	$('.square-' + move_obj.to).addClass('highlightLastMove');

	var move_string = move_obj.from + "-" + move_obj.to;
	
	if (move_obj.san == 'O-O' || move_obj.san == 'O-O-O' || move_obj.san[2] == '=' || move_obj.san[1] == 'x') {
		this.board.position(this.game.fen());
	} else {
		this.board.move(move_string);
	}
	return move_obj;
};

Chessy.prototype.moves = function(moveArray) {
	var move_obj;
	for (var i = 0; i < moveArray.length; ++i) {
		move_obj = this.game.move(moveArray[i]);
	}
	$('.square-55d63.highlightLastMove').removeClass('highlightLastMove');
	$('.square-' + move_obj.from).addClass('highlightLastMove');
	$('.square-' + move_obj.to).addClass('highlightLastMove');
	
	this.board.position(this.game.fen());
	return move_obj;
};

Chessy.prototype.flip = function() {
	this.board.flip();
	if (this.game.history().length != 0) {
		var move_obj = this.game.undo();
		$('.square-' + move_obj.from).addClass('highlightLastMove');
		$('.square-' + move_obj.to).addClass('highlightLastMove');
		this.game.move(move_obj);
	}
};

Chessy.prototype.undoPlayerMove = function() {
	this.game.undo();
	if (!this.isPlayersTurn() && this.game.history().length != 0)
		this.game.undo();
	this.board.position(this.game.fen());
	$('.square-55d63.highlightLastMove').removeClass('highlightLastMove');
	$('.square-55d63.highlightHint').removeClass('highlightHint');
	$("#board").removeClass("transparentBoard");
	this.highlightLastMove();
};

Chessy.prototype.undoOneMove = function() {
	this.game.undo();
	this.board.position(this.game.fen());
	$('.square-55d63.highlightLastMove').removeClass('highlightLastMove');
	$('.square-55d63.highlightHint').removeClass('highlightHint');
	$("#board").removeClass("transparentBoard");
	this.highlightLastMove();
};

Chessy.prototype.resize = function() {
	this.board.resize();
	this.highlightLastMove();
};

Chessy.prototype.highlightLastMove = function() {
	if (this.game.history().length != 0) {
		var move_obj = this.game.undo();
		$('.square-' + move_obj.from).addClass('highlightLastMove');
		$('.square-' + move_obj.to).addClass('highlightLastMove');
		this.game.move(move_obj);
	}
}

Chessy.prototype.setPosition = function(fen) {
	this.board.position(fen);
};

Chessy.prototype.gameIsOver = function() {
	$("#board").addClass("transparentBoard");
};

Chessy.prototype.reset = function() {
	this.board.start();
	this.game.reset();
	$('.square-55d63.highlightLastMove').removeClass('highlightLastMove');
	$('.square-55d63.highlightHint').removeClass('highlightHint');
	$("#board").removeClass("transparentBoard");
};

Chessy.prototype.history = function() {
	return this.game.history();
};

Chessy.prototype.isPlayersTurn = function() {
	if (this.board.orientation() == 'white' && this.game.turn() == 'b') return false;
	if (this.board.orientation() == 'black' && this.game.turn() == 'w') return false;
	return true;
};

Chessy.prototype.hintSmall = function(move) {
	var move_obj = this.game.san_to_obj(move);
	$(".square-"+move_obj.from + " > img").effect("shake", "", 400);
};

Chessy.prototype.hintBig = function(move) {
	var move_obj = this.game.san_to_obj(move);
	$(".square-"+move_obj.from + " > img").effect("shake", "", 400);
	$('.square-' + move_obj.from).addClass('highlightHint');
	$('.square-' + move_obj.to).addClass('highlightHint');
};

Chessy.prototype.isGameOver = function() {
	return this.game.game_over();
};

Chessy.prototype.greySquare = function(square) {
	var squareEl = $('#board .square-' + square);
  
	var background = '#d0c9b5';
	if (squareEl.hasClass('black-3c85d') === true) {
		background = '#957863';
	}

	squareEl.css('background', background);
}


}
/*
     FILE ARCHIVED ON 02:00:38 Jan 21, 2019 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 06:41:55 Mar 10, 2024.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  exclusion.robots: 0.101
  exclusion.robots.policy: 0.09
  cdx.remote: 0.105
  esindex: 0.009
  LoadShardBlock: 93.342 (6)
  PetaboxLoader3.datanode: 103.628 (8)
  load_resource: 250.599 (2)
  PetaboxLoader3.resolve: 121.153 (2)
*/