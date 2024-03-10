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

  const DEBUG = true;

  if (typeof localStorage == 'undefined') {
    alert("web storage is not supported");
    throw "no web storage";
  }

  var selectedOpeningBook = [];
  var cfg = {
    showNotation: false,
    draggable: true,
    position: 'start',
    onDragStart,
    onDrop,
    onSnapEnd
  };
  var chessy = new Chessy(cfg);
  var gameover = false;
  var loggedin = false;
  var username = '';
  var password = '';
  var timesHintAsked = 0;
  var perfectLine = true;
  var updatedHistory = false;
  var currentLine = "";
  var nextMove = "";
  var moveBlock = false;
  var currentTab = 'Openings';
  var gamePage = 0;
  var currentOpening = '';
  var genericBookIDs = ['1','2','3','4','5','6','7'];
  var myGenericBookIDs;
  var doRepeat = false;
  var mistakesCount = 0;
  var comments;

  function retrieveData(srs) {
    let whiteLines = [],
      blackLines = [];
    for (let line of srs.whiteSRSLines) {
      let item = localStorage.getItem(line.moves + '/white');
      if (item) {
        let data = JSON.parse(item);
        whiteLines.push([line.moves, new Date(data.timeDue), new Number(data.nextBox)]);
      }
    }
    return [whiteLines, blackLines];
  }
  // SRS
  function Line(moves, timeDue, nextBox) {
    this.moves = moves;
    this.timeDue = timeDue;
    this.nextBox = nextBox;
  }

  function SRS() {
    this.whiteSRSLines = [];
    this.blackSRSLines = [];
    this.timeToNextShowing = [25000, 120000, 600000, 3600000, 18000000, 86400000, 432000000, 2160000000, 10800000000, 54000000000, 270000000000];
    this.candidateLines = [];
    this.unseenLineTime = 0;
    this.whiteLinesReverse = {};
    this.blackLinesReverse = {};
    this.updateTimer = '';

    var thisSrs = this;
    // Load the SRS chockablock with lines
    var d = new Date();
    this.unseenLineTime = d.getTime() + 315360000000;
    var thisSrs = this;
    $.each(whiteLines, function(parentLine) {
      $.each(whiteLines[parentLine], function(innerLineIndex, childLine) {
        var newline = new Line(childLine, thisSrs.unseenLineTime, 0);
        thisSrs.whiteSRSLines.push(newline);

        if (!(childLine in thisSrs.whiteLinesReverse)) thisSrs.whiteLinesReverse[childLine] = [];
        thisSrs.whiteLinesReverse[childLine].push(parentLine);
      });
    });
    $.each(blackLines, function(parentLine) {
      $.each(blackLines[parentLine], function(innerLineIndex, childLine) {
        var newline = new Line(childLine, thisSrs.unseenLineTime, 0);
        thisSrs.blackSRSLines.push(newline);

        if (!(childLine in thisSrs.blackLinesReverse)) thisSrs.blackLinesReverse[childLine] = [];
        thisSrs.blackLinesReverse[childLine].push(parentLine);
      });
    });

    // Remove duplicate lines
    this.whiteSRSLines = unique_array(this.whiteSRSLines);
    this.blackSRSLines = unique_array(this.blackSRSLines);

    // A shuffle both randomizes lines shown to the player, and makes it much more likely to find possible lines
    // faster - a performance boost
    shuffle(this.whiteSRSLines);
    shuffle(this.blackSRSLines);

    this.loadCandidateLines(selectedOpeningBook);

    this.updateDueLines();

    var self = this;
    this.updateTimer = setInterval(function() { self.updateDueLines(); },8000);
  }

  SRS.prototype.destroy = function() {
    clearInterval(this.updateTimer);

    delete this.whiteSRSLines;
    delete this.blackSRSLines;
    delete this.timeToNextShowing;
    delete this.candidateLines;
    this.unseenLineTime = 0;
    delete this.whiteLinesReverse;
    delete this.blackLinesReverse;
    this.updateTimer = '';
  };

  SRS.prototype.loadCandidateLines = function(openings) {
    this.candidateLines = [];
    var thisSrs = this;
    $.each(openings, function(openingindex, openingdata) {
      if (chessy.orientation() == 'white') {
        if (!(openingdata in whiteLines)) return true; // continue
        $.each(whiteLines[openingdata], function(lineindex, linedata) {
          thisSrs.candidateLines.push(linedata);
        });
      } else if (chessy.orientation() == 'black') {
        if (!(openingdata in blackLines)) return true; // continue
        $.each(blackLines[openingdata], function(lineindex, linedata) {
          thisSrs.candidateLines.push(linedata);
        });
      }
    });
    shuffle(this.candidateLines);
  };

  SRS.prototype.getNextLine = function() {		
    var thisSrs = this;
    var ret = null;
    var SRSLines;
    if (chessy.orientation() == 'white') SRSLines = this.whiteSRSLines;
    if (chessy.orientation() == 'black') SRSLines = this.blackSRSLines;
    $.each(SRSLines, function(lineindex, linedata) {
      // if line is due before this time and is also in the candidate lines, return it
      var d = new Date();
      var thetime = d.getTime();

      $.each(thisSrs.candidateLines, function(candidatelineindex, candidatelinedata) {
        if (linedata.moves == candidatelinedata) {
          if (linedata.timeDue < thetime || linedata.timeDue == thisSrs.unseenLineTime) {
            ret = candidatelinedata;
            return false; // break
          }
        }
      });

      if (ret != null) return false; // break
    });
    if (ret != null) return ret;

    // If there's no line waiting to be made, return a random one from the candidate lines
    if (this.candidateLines.length == 0) return null;
    var anyAvailable = this.candidateLines[Math.floor(Math.random()*this.candidateLines.length)];
    return anyAvailable;
  };

  SRS.prototype.getAllDoneLines = function() {
    var whitelines = [];
    var blacklines = [];
    var thisSrs = this;
    var d = new Date();
    $.each(this.whiteSRSLines, function(lineindex, linedata) {
      if (linedata.timeDue < d.getTime() + 31536000000) {
        whitelines.push(linedata);
      }
    });
    $.each(this.blackSRSLines, function(lineindex, linedata) {
      if (linedata.timeDue < d.getTime() + 31536000000) {
        blacklines.push(linedata);
      }
    });
    return [whitelines, blacklines];
  }

  SRS.prototype.hasMoreLinesDue = function(openings) {
    if (openings == null) return false;
    if (openings.length == 0) return false;

    var thisSrs = this;
    var moreLinesDue = false;
    var SRSLines;
    if (chessy.orientation() == 'white') SRSLines = this.whiteSRSLines;
    if (chessy.orientation() == 'black') SRSLines = this.blackSRSLines;
    $.each(SRSLines, function(lineindex, linedata) {
      // if line is due before this time and is also in the candidate lines, return it
      var d = new Date();
      var thetime = d.getTime();

      $.each(thisSrs.candidateLines, function(candidatelineindex, candidatelinedata) {
        if (linedata.moves == candidatelinedata) {
          if (linedata.timeDue < thetime || linedata.timeDue == thisSrs.unseenLineTime) {
            moreLinesDue = true;
            return false; // break
          }
        }
      });

      if (moreLinesDue == true) return false; // break
    });
    return moreLinesDue;
  };

  SRS.prototype.doneLine = function(line, wasPerfect) {
    var SRSLines;
    if (chessy.orientation() == 'white') SRSLines = this.whiteSRSLines;
    if (chessy.orientation() == 'black') SRSLines = this.blackSRSLines;

    var lineIndex = SRSLines.findIndex(l => l.moves == line);

    var d = new Date();
    var theTime = d.getTime();
    var wasKnownBefore = (SRSLines[lineIndex].nextBox > 0);
    if ((SRSLines[lineIndex].timeDue < theTime || SRSLines[lineIndex].timeDue == this.unseenLineTime) && wasPerfect) {
      let nextBox = ++SRSLines[lineIndex].nextBox;
      let timeDue = SRSLines[lineIndex].timeDue = theTime + this.timeToNextShowing[SRSLines[lineIndex].nextBox];
      localStorage.setItem(
        SRSLines[lineIndex].moves + '/' + chessy.orientation(),
        JSON.stringify(
          {
            nextBox,
            timeDue
          }
        )
      );
      //sendLineToServer(SRSLines[lineIndex].moves, SRSLines[lineIndex].timeDue, SRSLines[lineIndex].nextBox, chessy.orientation(), 1);
    } else if (SRSLines[lineIndex].timeDue >= theTime && wasPerfect) {
      // Do nothing
    } else if (!wasPerfect) {
      let nextBox = SRSLines[lineIndex].nextBox = 0;
      let timeDue = SRSLines[lineIndex].timeDue = theTime + this.timeToNextShowing[SRSLines[lineIndex].nextBox];
      localStorage.setItem(
        SRSLines[lineIndex].moves + '/' + chessy.orientation(),
        JSON.stringify(
          {
            nextBox,
            timeDue
          }
        )
      );
      //sendLineToServer(SRSLines[lineIndex].moves, SRSLines[lineIndex].timeDue, SRSLines[lineIndex].nextBox, chessy.orientation(), 1);
    }

    $("#timeTillShown").text(millisecondsToString(SRSLines[lineIndex].timeDue - theTime));
    if (wasPerfect) {
      // $("#warning").text("Success! Line will be shown again in " + millisecondsToString(SRSLines[lineIndex].timeDue - theTime));

    } else {
      // $("#warning").text("Not yet perfect. Line will be shown again in " + millisecondsToString(this.timeToNextShowing[SRSLines[lineIndex].nextBox]));
    }

    var lineObject = jQuery.extend({}, SRSLines[lineIndex]);
    // insert the lineObject into the correct place by its timeDue
    SRSLines.splice(lineIndex, 1);
    if (lineObject.timeDue < SRSLines[0].timeDue) {
      SRSLines.splice(0, 0, lineObject);
    } else if (lineObject.timeDue > SRSLines[SRSLines.length-1].timeDue) {
      SRSLines.splice(SRSLines.length-1, 0, lineObject);
    } else {
      for (var i = 0; i < SRSLines.length-1; ++i) {
        if (lineObject.timeDue < SRSLines[i+1].timeDue && lineObject.timeDue >= SRSLines[i].timeDue) {
          SRSLines.splice(i+1, 0, lineObject);
          break;
        }
      }
    }
    if (chessy.orientation() == 'white') this.whiteSRSLines = SRSLines;
    if (chessy.orientation() == 'black') this.blackSRSLines = SRSLines;


    // Update the number of lines learnt for all openings this line is in
    lineArray = splitStringIntoMoves(line);
    var candidateOpeningLine = '';
    for (var i = 0; i < lineArray.length; ++i) {
      candidateOpeningLine += lineArray[i];
      if (candidateOpeningLine in opening_book) {
        if (chessy.orientation() == 'white') {
          if (!($.inArray(candidateOpeningLine, this.whiteLinesReverse[line]) > -1)) continue;
          if (wasKnownBefore && !wasPerfect) opening_book[candidateOpeningLine][3] -= 1
          if (!wasKnownBefore && wasPerfect) opening_book[candidateOpeningLine][3] += 1
          // also remove 1 due line if it was due
          if (opening_book[candidateOpeningLine][6] >= 1) opening_book[candidateOpeningLine][6]--;
          addProgressBar(candidateOpeningLine);
          addToolTipToOpening(opening_book[candidateOpeningLine][0]);
        } else if (chessy.orientation() == 'black') {
          if (!($.inArray(candidateOpeningLine, this.blackLinesReverse[line]) > -1)) continue;
          if (wasKnownBefore && !wasPerfect) opening_book[candidateOpeningLine][4] -= 1
          if (!wasKnownBefore && wasPerfect) opening_book[candidateOpeningLine][4] += 1
          if (opening_book[candidateOpeningLine][6] >= 1) opening_book[candidateOpeningLine][7]--;
          addProgressBar(candidateOpeningLine);
          addToolTipToOpening(opening_book[candidateOpeningLine][0]);
        }
      }
    }

    return wasKnownBefore;
  };

  function sendLineToServer(moves, timeDue, nextBox, colour, timestried) {
    if (!loggedin) return;

    $.post( "api.php", { action: 'update', username, password, moves, timedue, nextbox, colour }, function( data ) {
      if (data == 'notloggedin') {
        alert("Session expired. Please login again");
        logout();
      } else if (data != 'success') {
        alert("error contacting server to update line");
      }
    }).fail(function() {
      if (timestried > 3) {
        alert("error contacting server to update line");
      } else {
        setTimeout(function(){sendLineToServer(moves, timeDue, nextBox, colour, timestried+1);}, 1000);
      }
    });
  }

  SRS.prototype.updateDueLines = function() {
    var thisSrs = this;
    var d = new Date();
    var theTime = d.getTime();
    // Set all due lines due to 0
    $.each(opening_book, function(openingindex, openingdata) {
      openingdata[6] = 0;
      openingdata[7] = 0;
    });

    if (chessy.orientation() == 'white') {
      $.each(this.whiteSRSLines, function(lineindex, linedata) {
        if (thisSrs.whiteSRSLines[lineindex].timeDue > theTime) return false; // break
        $.each(thisSrs.whiteLinesReverse[linedata.moves], function(reverseindex, reversedata) {
          opening_book[reversedata][6] += 1;
        });		
      });
    } else if (chessy.orientation() == 'black') {
      $.each(this.blackSRSLines, function(lineindex, linedata) {
        if (thisSrs.blackSRSLines[lineindex].timeDue > theTime) return false; // break
        $.each(thisSrs.blackLinesReverse[linedata.moves], function(reverseindex, reversedata) {
          opening_book[reversedata][7] += 1;
        });	
      });
    }

    $('.openingLineName').each(function() {
      var name = $(this).text();
      addToolTipToOpening(name);
    });
  };

  SRS.prototype.updateSRS = function(data) {
    var thisSRS = this;
    var whiteLines = data[0];
    var blackLines = data[1];

    // Place the downloaded data into the SRS
    $.each(whiteLines, function(dataindex, dataval) {
      var moves = dataval[0];
      var timeDue = dataval[1];
      var nextBox = dataval[2];
      $.each(thisSRS.whiteSRSLines, function(srsindex, srsval) {
        if (srsval.moves == moves) {
          srsval.timeDue = timeDue;
          srsval.nextBox = nextBox;
          return false; // break
        }
      });
    });
    thisSRS.whiteSRSLines.sort(function(a, b) {
      return a.timeDue - b.timeDue;
    });
    $.each(blackLines, function(dataindex, dataval) {
      var moves = dataval[0];
      var timeDue = dataval[1];
      var nextBox = dataval[2];
      $.each(thisSRS.blackSRSLines, function(srsindex, srsval) {
        if (srsval.moves == moves) {
          srsval.timeDue = timeDue;
          srsval.nextBox = nextBox;
          return false; // break
        }
      });
    });
    thisSRS.blackSRSLines.sort(function(a, b) {
      return a.timeDue - b.timeDue;
    });

    // Update the history (number learnt)
    $.each(opening_book, function(index) {
      opening_book[index][3] = 0;
      opening_book[index][4] = 0;
    });

    // Write the number of known lines
    $.each(this.whiteSRSLines, function(lineindex, linedata) {
      if (linedata.nextBox > 0) {
        $.each(thisSRS.whiteLinesReverse[linedata.moves], function(reverseindex, reversedata) {
          opening_book[reversedata][3] += 1
        });
      }
    });
    $.each(this.blackSRSLines, function(lineindex, linedata) {
      if (linedata.nextBox > 0) {
        $.each(thisSRS.blackLinesReverse[linedata.moves], function(reverseindex, reversedata) {
          opening_book[reversedata][4] += 1
        });
      }
    });
    $.each(opening_book, function(opening_index, opening_data) {
      addProgressBar(opening_index);
      addToolTipToOpening(opening_book[opening_index][0]);
    });


    $(document).tooltip();

    this.updateDueLines();
  };
  SRS.prototype.print = function() {
    var SRSLines;
    if (chessy.orientation() == 'white') SRSLines = this.whiteSRSLines;
    if (chessy.orientation() == 'black') SRSLines = this.blackSRSLines;

    var d = new Date();
    for (var i = 0; i < SRSLines.length; ++i) {
      var l = SRSLines[i];
      if (l.timeDue == this.unseenLineTime) break;
      console.log(l.moves + " " + ((l.timeDue - d.getTime()) / 1000) + " " + l.nextBox);
    }
  };
  // end SRS

  $( window ).resize(function() {
    var viewportWidth = $(window).width();
    var viewportHeight = $(window).height();
    if (viewportWidth < viewportHeight) {
      $("#boardWrap").removeClass("squareByHeight");
      $("#boardWrap").addClass("squareByWidth");
      $(".underBoard").removeClass("rectangleByHeight");
      $(".underBoard").addClass("rectangleByWidth");
    } else {
      $("#boardWrap").removeClass("squareByWidth");
      $("#boardWrap").addClass("squareByHeight");
      $(".underBoard").removeClass("rectangleByWidth");
      $(".underBoard").addClass("rectangleByHeight");
    }
    chessy.resize();
  });

  function showWelcome() {
    $(".overlay").css("opacity", "0");
    $(".overlay").fadeTo(1000, 0.4);
    $(".overlay").height($(window).height());
    $(".overlay").width($(window).width());
    $("#welcomedlg").dialog({
      dialogClass: "no-close",
      title: "How It Works",
      width: "500px",
      height: "auto",
      buttons: {
        Begin: function() {
          $(this).dialog("close");
        }
      },
      show: {
        effect: "fade",
        duration: 1000
      },
      hide: {
        effect: "fade",
        duration: 500
      },
      beforeClose: function () {
        $(".overlay").fadeTo(350, 0);
      },
      close: function () {
        $(".overlay").css("display", "none");
      }
    });
    $("#attribution").remove();
    $(".ui-dialog-buttonpane").append('<span id="attribution">site by jay bulgin, sounds <a href="https://web.archive.org/web/20190130125125/https://creativecommons.org/licenses/by/3.0/">CC</a> by <a href="https://web.archive.org/web/20190130125125/http://www.freesound.org/people/SuGu14/packs/5082/">SuGu14</a> and <a href="https://web.archive.org/web/20190130125125/http://www.freesound.org/people/rhodesmas/sounds/322896/">rhodesmas</a></span>');
  }

  function signup(e) {
    if (e.preventDefault) e.preventDefault();

    $("#signuperror").html('&nbsp;');

    var username = $("#signupusername").val();
    var password = $("#signuppassword").val();
    var password2 = $("#signuppassword2").val();
    var knownLines = srs.getAllDoneLines();
    var email = $("#signupemail").val();

    // Validations
    if (username.length < 3) {
      $("#signuperror").text('Username needs to be at least 3 characters');
      return false;
    }
    if (/\W/.test(username)) {
      $("#signuperror").text('Username can only contain letters, numbers and underscores');
      return false;
    }
    if (password.length < 6) {
      $("#signuperror").text('Password needs to be at least 6 characters');
      return false;
    }
    if (password != password2) {
      $("#signuperror").text('Passwords do not match');
      return false;
    }

    $.post( "api.php", { action: 'signup', username: username, password: password, email: email, whitelines: knownLines[0], blacklines: knownLines[1] }, function( data ) {
      if (data != 'success') {
        $("#signuperror").text(data);
      } else {
        doLogin(username, password);
        $('#signup-content').slideToggle();
        $('#signup-trigger').toggleClass('active');
      }
    }).fail(function() {
      $("#signuperror").text("Problem contacting server");
    });

    return false;
  }
  var form = document.getElementById('signupform');
  if (form.attachEvent) {
    form.attachEvent("submit", signup);
  } else {
    form.addEventListener("submit", signup);
  }

  function login(e) {
    if (e.preventDefault) e.preventDefault();

    $("#loginerror").html('&nbsp;');

    var username = $("#loginusername").val();
    var password = $("#loginpassword").val();

    doLogin(username, password);
  }
  function doLogin(_username, _password) {
    $.post( "api.php", { action: 'login', username: _username, password: _password }, function( data ) {
      if (data.substring(0, 7) != 'success') {
        $("#loginerror").text(data);
      } else {
        loggedin = true;
        username = data.substring(7);
        password = _password;
        $("#loginerror").html('&nbsp;');
        $("#username").text(username);
        $("#loginpassword").val('');
        $("#logout").css('display', 'inline-block');
        $("#username").css('display', 'inline-block');
        if ($('#login-trigger').hasClass('active')) {
          $('#login-content').slideToggle();
          $('#login-trigger').toggleClass('active');
        }
        $("#login-trigger").css('display', 'none');
        $("#signup-trigger").css('display', 'none');

        $.post( "api.php", { action: 'getlines', username: username, password: password }, function(data) {
          data = JSON.parse(data);
          srs.updateSRS(data);
        }, () => console.warn("fail to send an HTTP POST request")
        );

      }
    }).fail(function() {
      $("#loginerror").text("Problem contacting server");
    });
  }
  var form = document.getElementById('loginform');
  if (form.attachEvent) {
    form.attachEvent("submit", login);
  } else {
    form.addEventListener("submit", login);
  }

  /*
    // COMMENTS SECTION

function getComments(doDisplay) {
        var _isWhite = Number(chessy.orientation() == 'white');
        $.post( "api.php", { action: 'getcomments', line: currentLine, iswhite: _isWhite }, function( data ) {
                data = JSON.parse(data);
                comments = data;
                if (doDisplay == "and display") displayComments();
        }).fail(function() {
                alert("Can't connect to server to get comments");
        });
}

function displayComments() {
        $("#commentsSection").empty();
        var moveList = splitStringIntoMoves(currentLine);
        var curPair = 1;
        for (var i = 0; i < chessy.history().length; i+=2) {
                var moves = curPair.toString() + ": " + moveList[i];
                if (i+1 < moveList.length) moves += " " + moveList[i+1];
                var append = '<div class="commentsBox" id="comment' + (parseInt(i/2)+1) + '">';
                append += '<div class="commentMove">' + moves + '<span class="commentAddbtn" onclick="addComment(' + curPair + ')">add comment</span></div>';

                for (var j = 0; j < comments.length; ++j) {
                        if (comments[j][3] == (i/2)+1) {
                                append += '<div class="comment">';
                                append += '<div class="commentText">'+escapeHtml(comments[j][2]) + '</div>';
                                append += '<div class="commentFooter">&nbsp;';
                                if (comments[j][1] == username) {
                                        append += '<span class="commentDelete" onclick="deleteComment(' + comments[j][0] + ')">[X]</span>';
                                }
                                append += '<span class="commentOwner">' + escapeHtml(comments[j][1]) + '</span></div></div>';
                        }
                }

                append += '</div>';
                $("#commentsSection").append(append);
                curPair++;
        }
}

function addComment(commentid) {
        if (!loggedin) {
                alert("Please login to post comments");
                return;
        }
        if ($("#newComment"+commentid).length) {
                $("#newComment"+commentid).remove();
                $("#btnAddComment"+commentid).remove();
                $("#btnCancelComment"+commentid).remove();
        } else {
                $("#comment"+commentid).append('<textarea class="newComment" id="newComment'+commentid+'" type="text" name="newComment" placeholder="Write your comment here">');
                $("#comment"+commentid).append('<button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only" id="btnAddComment'+commentid+'" role="button" onclick="postComment('+commentid+')"><span class="ui-button-text">Add</span></button>');
                $("#comment"+commentid).append('<button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only" id="btnCancelComment'+commentid+'" role="button" onclick="cancelComment('+commentid+')"><span class="ui-button-text">Cancel</span></button>');
        }
}

function postComment(commentid) {
        var _comment = $("#newComment"+commentid).val();
        var _isWhite = Number(chessy.orientation() == 'white');
        var _moveNum = commentid;

        $.post( "api.php", { action: 'postcomment', comment: _comment, line: currentLine, iswhite: _isWhite, movenum: _moveNum }, function( data ) {
                getComments("and display");
//var append = '<div class="comment"><div class="commentText">' + _comment + '</div><div class="commentOwner">Jay</div></div>';
//$("#comment"+_moveNum).append(append);
                $("#newComment"+commentid).remove();
                $("#btnAddComment"+commentid).remove();
                $("#btnCancelComment"+commentid).remove();
        }).fail(function() {
                alert("Problem contacting server");
        });
}

function deleteComment(_commentid) {
        $.post( "api.php", { action: 'deletecomment', commentid: _commentid }, function( data ) {
          //$("#comment" + _commentid).remove();
                getComments("and display");
        }).fail(function() {
                alert("Problem contacting server");
        });
}

// END COMMENTS SECTION
*/

$("#btnnew").click(function() {
  if( $("img").is(':animated')) return;
  newGame();
});

  $("#btnCloseOverlay").click(function() {
    $("#introOverlay").css('display', 'none');
  });


  $("#btnflip").click(function() {
    if( $("img").is(':animated')) return;
    timesHintAsked = 0;
    if (chessy.history().length >= 1) {
      updatedHistory = true; // don't allow the user to win lines after flipping
    }
    chessy.flip();
    $("#warning").text("");

    // Find all expanded elements
    var wasExpanded = [];
    $('.expander').each(function() {
      if ($(this).text() == '-') {
        wasExpanded.push($(this).parent().children('.openingLineName').attr('id'));
      }
    });

    // Find all selected elements
    var wasSelected = [];
    $('.openingLine.selected').each(function() {
      wasSelected.push($(this).children('.openingLineName').attr('id'));
    });

    // De-select all selected elements
    $.each(wasSelected, function(i, selectedID) {
      $("#" + selectedID).parent().removeClass('selected');
    });

    // Un-expand all expanded elements
    $.each(wasExpanded, function(i, expandedID) {
      $("#" + expandedID).parent().children('.expander').click();
    });

    // Expand all expanded elements
    $.each(wasExpanded, function(i, expandedID) {
      $("#" + expandedID).parent().children('.expander').click();
    });

    // Select all selected elements
    $.each(wasSelected, function(i, selectedID) {
      $("#" + selectedID).parent().addClass('selected');
    });

    addToolTipToOpening("King's Pawn Opening, General");
    addToolTipToOpening("Queen Pawn Opening, General");
    addToolTipToOpening("English Opening, General");
    addToolTipToOpening("Zukertort Opening, General");
    addToolTipToOpening("Hungarian Opening, General");
    addToolTipToOpening("Bird Opening, General");
    addToolTipToOpening("Van Geet Opening, General");
    // addToolTipToOpening("Grob's Attack (Traps)");

    addProgressBar("e4");
    addProgressBar("d4");
    addProgressBar("c4");
    addProgressBar("Nf3");
    addProgressBar("g3");
    addProgressBar("f4");
    addProgressBar("Nc3");

    srs.loadCandidateLines(selectedOpeningBook);
    if (chessy.history().length == 0) {
      currentLine = srs.getNextLine(selectedOpeningBook);
      if (currentLine === null) {
        nextMove = '';
      } else {
        nextMove = getNextMove(chessy.history().join(''), currentLine);
      }
    }

    srs.updateDueLines();

    if (!isPlayersTurn()) setTimeout(makeOpponentMove, 500);
  });

$("#btnundo").click(function() {
  if( $("img").is(':animated')) return;
  if (chessy.history().length == 0) return;

  gameover = false;
  perfectLine = false;
  timesHintAsked = 0;
  $("#btnhint").children('.ui-button-text').removeClass("inProgressBtn");
  $("#warning").text("");
  chessy.undoPlayerMove();
  updateOpeningText();
  nextMove = getNextMove(chessy.history().join(''), currentLine);
});

$("#helpbtn").click(function() {
  showWelcome();
});

$("#btnhint").click(function() {
  showHint();
});

$('#login-trigger').click(function() {
  if ($('#signup-trigger').hasClass('active')) {
    $('#signup-content').slideToggle();
    $('#signup-trigger').toggleClass('active');
  }
  $(this).next('#login-content').slideToggle();
  $(this).toggleClass('active');
  $("#loginusername").focus();
});
$('#signup-trigger').click(function() {
  if ($('#login-trigger').hasClass('active')) {
    $('#login-content').slideToggle();
    $('#login-trigger').toggleClass('active');
  }
  $(this).next('#signup-content').slideToggle();
  $(this).toggleClass('active');          
  $("#signupusername").focus();
});
$('#logout').click(function() {
  logout();
});
function logout() {
  $.post( "api.php", { action: 'logout' }, function( data ) {
    if (data == 'success') {
      loggedin = false;
      $("#logout").css('display', 'none');
      $("#username").css('display', 'none');
      $("#login-trigger").css('display', 'inline-block');
      $("#signup-trigger").css('display', 'inline-block');

      srs.destroy();
      srs = new SRS();

      // Update the history
      $.each(opening_book, function(index) {
        opening_book[index][3] = 0;
        opening_book[index][4] = 0;
        opening_book[index][6] = 0;
        opening_book[index][7] = 0;
      });
      srs.updateDueLines();

      $(".openingLineName").each(function(){
        var name = $(this).text();
        addProgressBar(opening_book_moves[name]);
        addToolTipToOpening(name);						
      });

      $(document).tooltip();
    } else {
      alert("error logging out");
    }
  }).fail(function() {
    alert("error contacting server"); 
  });
}
$(document).keyup(function(e) {
  if (e.keyCode == 27) {
    if ($('#signup-trigger').hasClass('active')) {
      $('#signup-content').slideToggle();
      $('#signup-trigger').toggleClass('active');
    }
    if ($('#login-trigger').hasClass('active')) {
      $('#login-content').slideToggle();
      $('#login-trigger').toggleClass('active');
    }
  }
});
$('#main').click(function() {
  if ($('#login-trigger').hasClass('active')) {
    $('#login-content').slideToggle();
    $('#login-trigger').toggleClass('active');
  }
  if ($('#signup-trigger').hasClass('active')) {
    $('#signup-content').slideToggle();
    $('#signup-trigger').toggleClass('active');
  }
});

$("body").on("click", ".expander", function(e) {
  e.stopPropagation();
  if ($(this).text() == '+') {
    var thisopeningname = $(this).parent().children('.openingLineName').text();
    var thisopeningmoves = opening_book_moves[thisopeningname];
    var nummovesthisopening = countMoves(thisopeningmoves);
    var thisOpeningLineElement = $(this);
    var thiselement = $(this);
    var numAdded = 0;
    var opening_book_sorted = [];
    $.each(opening_book, function(move, data) {
      if (data[5] == thisopeningmoves) {
        if ((chessy.orientation() == 'white' && data[1] > 10) ||
          (chessy.orientation() == 'black' && data[2] > 10)) {
          numAdded++;
          opening_book_sorted.push([move, data]);
        }
      }
    });
    var sortcol = 1;
    if (chessy.orientation() == 'black') sortcol = 2;
    opening_book_sorted.sort(function(a, b) {
      return b[1][sortcol] - a[1][sortcol];
    });
    $.each(opening_book_sorted, function() {
      var move = $(this)[0];
      var name = $(this)[1][0];
      var idname = name.replace(/[^a-zA-Z0-9]/g,"");
      if (opening_book[move][8] == 0 && chessy.orientation() == 'white') {
        thisOpeningLineElement.parent().append('<div class="openingLine"><span class="expander">+</span><span id="' + idname + '" class="openingLineName">' + name + '</span></div>');
      }
      if (opening_book[move][8] == 1 && chessy.orientation() == 'white') {
        thisOpeningLineElement.parent().append('<div class="openingLine"><span class="expander">&nbsp;</span><span id="' + idname + '" class="openingLineName">' + name + '</span></div>');
      }
      if (opening_book[move][9] == 0 && chessy.orientation() == 'black') {
        thisOpeningLineElement.parent().append('<div class="openingLine"><span class="expander">+</span><span id="' + idname + '" class="openingLineName">' + name + '</span></div>');
      }
      if (opening_book[move][9] == 1 && chessy.orientation() == 'black') {
        thisOpeningLineElement.parent().append('<div class="openingLine"><span class="expander">&nbsp;</span><span id="' + idname + '" class="openingLineName">' + name + '</span></div>');
      }
      addToolTipToOpening(name);
      addProgressBar(opening_book_moves[name]);
    });
    $(this).text('-');
    $(this).css('padding-bottom', '2px');
    if (numAdded == 0) $(this).text('');

    srs.updateDueLines();

  } else if ($(this).text() == '-'){
    // find all selected openings under this opening and click them
    $(this).parent().find(".openingLine.selected").each(function(){
      $(this).children(".openingLineName").click();
    });

    $(this).parent().find("div").remove();
    $(this).text('+');
    $(this).css('padding-bottom', '0');
  }
});

$("body").on("click", ".openingLineName", function(e) {
  e.stopPropagation();
  var element = $(this).parent();

  element.toggleClass('selected');
  if (element.hasClass('selected')) {
    element.parents().removeClass('selected');
    $(element).find('div').each(function(){
      $(this).removeClass('selected');
    });
  }
  updateSelectedOpeningBook();
  srs.loadCandidateLines(selectedOpeningBook);
  if (chessy.history().length == 0) {
    currentLine = srs.getNextLine(selectedOpeningBook);
    //getComments("");
    if (currentLine === null) {
      nextMove = '';
    } else {
      nextMove = getNextMove(chessy.history().join(''), currentLine);
    }
    if (!isPlayersTurn()) setTimeout(makeOpponentMove, 500);
  }

  // Make each of the first moves bounce if the board is at the start
  if (chessy.game.history().length == 0) {
    for (var i = 0; i < selectedOpeningBook.length; ++i) {
      var firstMove = splitStringIntoMoves(selectedOpeningBook[i])[0];
      var firstPiece = chessy.game.san_to_obj(firstMove).from;
      $(".square-"+firstPiece + " > img").effect("bounce", "slow");
    }
  }
});

$("body").on("click", "#tabOpeningButton", function(e) {
  if (currentTab == 'Openings') return;

  currentTab = 'Openings';
  $(".ui-layout-east").css("background", "linear-gradient(#BEFFBA, #5DFF53)");
  $(".ui-layout-east").css("border", "1px solid #2A2");
  $("#tabHeader").text("Opening Chooser");
  $("#gameExplorer").hide();
  $("#commentsSection").hide();
  $("#openingBox").show();
});

$("body").on("click", "#tabGamesButton", function(e) {
  if (currentTab == 'Games') return;

  currentTab = 'Games';
  $(".ui-layout-east").css("background", "linear-gradient(#FFDABF, #FF9C53)");
  $(".ui-layout-east").css("border", "1px solid #AA6522");
  $("#tabHeader").text("Game Explorer");
  $("#openingBox").hide();
  $("#commentsSection").hide();
  $("#gameExplorer").show();
  getGames(gamePage);

  if (gamePage == 0) {
    $("#btnGamesLeft").addClass("disabledBtn");
  }
});

$("body").on("click", "#tabCommentsButton", function(e) {
  if (currentTab == 'Comments') return;

  currentTab = 'Comments';
  $(".ui-layout-east").css("background", "linear-gradient(#C6BFFF, #6D53FF)");
  $(".ui-layout-east").css("border", "1px solid #3122AA");
  $("#tabHeader").text("Comments");
  $("#gameExplorer").hide();
  $("#openingBox").hide();
  $("#commentsSection").show();
  //displayComments();
});

$("body").on("click", "#btnGetGames", function(e) {
  gamePage = 0;
  getGames(gamePage);
});

$("body").on("click", "#btnGamesLeft", function(e) {
  if ($(this).hasClass("disabledBtn")) return;

  gamePage--;
  getGames(gamePage);

  if (gamePage == 0) {
    $("#btnGamesLeft").addClass("disabledBtn");
  }
});

$("body").on("click", "#btnGamesRight", function(e) {
  if ($(this).hasClass("disabledBtn")) return;

  gamePage++;
  getGames(gamePage);
  $("#btnGamesLeft").removeClass("disabledBtn");
});

function cancelComment(commentid) {
  $("#newComment"+commentid).remove();
  $("#btnAddComment"+commentid).remove();
  $("#btnCancelComment"+commentid).remove();
}

function getGames(gamePage) {
  if ($("#btnGetGames").hasClass("inProgressBtn")) return;

  $("#btnGetGames").addClass("inProgressBtn");
  $("#gamesBox").html("");
  $("#gamesBox").append('<img id="gamesLoadingIcon" src="img/loading.svg" height="30" width="30">');
  $.post( "api.php", { action: 'getgames', moves: chessy.history().join(''), page: gamePage }, function( data ) {
    $("#gamesLoadingIcon").remove();
    $("#btnGetGames").removeClass("inProgressBtn");
    data = JSON.parse(data)
    $.each(data, function(gameIndex, gameRecord) {
      var id = gameRecord[0];
      var date = gameRecord[1];
      var whiteName = gameRecord[2];
      var whiteELO = gameRecord[3];
      var blackName = gameRecord[4];
      var blackELO = gameRecord[5];
      var result = gameRecord[6];
      $("#gamesBox").append('<div class="gameLine"><span class="gameLineName" id="game'+id+'">' + whiteName + ' (' + whiteELO + ') vs ' + blackName + ' (' + blackELO + ')' + '</span></div>');
      $("#game"+id).data("gameid", id);
    });

    if ($(".gameLine").length < 20) {
      $("#btnGamesRight").addClass("disabledBtn");
    } else {
      $("#btnGamesRight").removeClass("disabledBtn");
    }

    if (data.length == 0) {
      $("#gamesBox").append('<div class="gameLine"><span class="gameLineName" id="emptyGame">(None)</span></div>');
      $("#emptyGame").data("gameid", "emptyGame");
    }
    // for (var i = data.length; i < 20; ++i) {
    //	$("#gamesBox").append('<div class="gameLine"><span class="gameLineName" id="emptyGame">&nbsp;</span></div>');
    // }
  }).fail(function() {
    if (timestried > 3) {
      alert("error contacting server to update line");
    } else {
      setTimeout(function(){sendLineToServer(moves, timeDue, nextBox, colour, timestried+1);}, 1000);
    }
  });
}

function preloadBookImages() {
  var images = new Array();
  for (var i = 0; i < preload_images.length; i++) {
    // $("<img />").attr("src", preload_images[i]);
    images[i] = new Image();
    images[i].src = preload_images[i];
  }
}

function getBookHTML(bookid) {
  var retString = '';
  var bookLinkIndexStart = bookid + "-start";

  var bookLinkIndexEnd = bookid + "-end";
  if (bookid == 1) {
    bookLinkIndexStart = bookid + "_" + genericBookIDs[0] + "-start";
    bookLinkIndexEnd = bookid + "_" + genericBookIDs[0] + "-end";
  }

  // retString = "<div class='bookLink'>" + books[bookLinkIndexStart] + "_SL250_" + books[bookLinkIndexEnd] + "</div>";
  retString = "<div class='bookLink'>" + books[bookLinkIndexStart] + "_SL160_" + books[bookLinkIndexEnd] + "</div>";

  /*if ($("#finishdlg").width() > 176) {
                retString = "<div class='bookLink'>" + books[bookLinkIndexStart] + "_SL250_" + books[bookLinkIndexEnd] + "</div>";
        } else if ($("#booksBox").width() > 112) {
                retString = "<div class='bookLink'>" + books[bookLinkIndexStart] + "_SL160_" + books[bookLinkIndexEnd] + "</div>";
        } else {
                retString = "<div class='bookLink'>" + books[bookLinkIndexStart] + "_SL110_" + books[bookLinkIndexEnd] + "</div>";
        }*/
  return retString;
}

$("body").on("click", ".gameLineName", function(e) {
  var id = $(this).data("gameid");
  if (id == 'emptyGame') return;
  window.open('game.html?i='+id, 'View Game');
});

function newGame() {
  $("#warning").text("");
  $("#opening").html('&nbsp;');
  if ($("#finishdlg").hasClass('ui-dialog-content'))
    $("#finishdlg").dialog("close");
  if ($("#finishdlgnonedue").hasClass('ui-dialog-content'))
    $("#finishdlgnonedue").dialog("close");

  chessy.reset();
  mistakesCount = 0;
  genericBookIDs = shuffle(genericBookIDs);

  if (!updatedHistory && !perfectLine) {
    srs.doneLine(currentLine, false);
    // srs.updateDueLines();
    updatedHistory = true;
  }

  gameover = false;
  perfectLine = true;
  updatedHistory = false;
  timesHintAsked = 0;
  if (!doRepeat) {
    currentLine = srs.getNextLine(selectedOpeningBook);
    //getComments("");
  }
  doRepeat = false;
  if (currentLine === null) {
    showMessage('openingneededdlg', 'Note', '130px');
    nextMove = '';
  } else {
    nextMove = getNextMove(chessy.history().join(''), currentLine);
  }
  //displayComments();
  if (!chessy.isPlayersTurn()) setTimeout(makeOpponentMove, 500);
}

function addToolTipToOpening(name) {
  if ($(".ui-tooltip").length > 0) {
    setTimeout(function(){addToolTipToOpening(name);}, 500);
    return;
  }

  var moves = opening_book_moves[name];
  var elementid = name.replace(/[^a-zA-Z0-9]/g,"");

  if (chessy.orientation() == 'white') {
    $('#' + elementid).prop('title', 
      "<img src='img/openings/" + elementid + ".png' height='159' width='160'><br />" + 
      "Lines:&nbsp;<span style='float: right'>" + opening_book[moves][1] + "</span><br />" + 
      "Learnt:&nbsp;<span style='float: right'>" + opening_book[moves][3] + "</span><br />" + 
      "Due:&nbsp;<span style='float: right'>" + opening_book[moves][6] + "</span>");
  } else {
    $('#' + elementid).prop('title', 
      "<img src='img/openings/" + elementid + "_black.png' height='159' width='160'><br />" + 
      "Lines:&nbsp;<span style='float: right'>" + opening_book[moves][2] + "</span><br />" + 
      "Learnt:&nbsp;<span style='float: right'>" + opening_book[moves][4] + "</span><br />" + 
      "Due:&nbsp;<span style='float: right'>" + opening_book[moves][7] + "</span>");
  }

  $('#' + elementid).tooltip({
    content: function() {
      return $(this).attr('title');
    },
    position: { my: "left top+25", at: "left bottom", collision: "flipfit" },
    tooltipClass: "tooltipHint"
  });
}

function countMoves(s) {
  var countdigits = 0, countos = 0;
  for (var j = 0; j < s.length; ++j) {
    if (s[j] >= '0' && s[j] <= '9') {
      countdigits++;
    } else if (s[j] == 'O') {
      countos++;
    }
  }
  var nummoves = countdigits;
  if (countos == 2 || countos == 3) nummoves++;
  if (countos == 4 || countos == 5 || countos == 6) nummoves++;
  return nummoves;
}

function showHint() {
  if( $("img").is(':animated')) return;

  if (chessy.history().length >= 2) perfectLine = false;
  timesHintAsked += 1;

  if (timesHintAsked == 1) {
    chessy.hintSmall(nextMove);
  } else if (timesHintAsked >= 2) {
    chessy.hintBig(nextMove);
  }
}

function onDragStart(source, piece) {
  if (gameover) return false;
  if( $("img").is(':animated')) return false;
  if (moveBlock) return false;

  if (nextMove == '') {
    showMessage('openingneededdlg', 'Note', '130px');
    return false;
  }

  var moves = chessy.game.moves({
    square: source,
    verbose: true
  });

  if (moves.length === 0) return false;
  if (chessy.isGameOver()) return false;
  if (!chessy.isPlayersTurn()) return false;

  chessy.greySquare(source);

  for (var i = 0; i < moves.length; i++) {
    chessy.greySquare(moves[i].to);
  }
}

function sumMoveFreq(a) {
  var c = 0;
  for (var i = 0; i < a.length; ++i) {
    c += a[i][1];
  }
  return c;
}

function onDrop(source, target) {
  // remove grey squares
  $('#board .square-55d63').css('background', '');

  // see if the move is legal
  var move = chessy.game.move({
    from: source,
    to: target,
    promotion: 'q'
  });

  // illegal move
  if (move === null) return 'snapback';

  // if not most suggested move
  if (nextMove != move['san']) {
    // Perhaps it is from a different selected opening?
    var isFromOtherOpening = false;
    var allMoves = chessy.game.history().join('');
    var candidateOpenings = [];
    for (var i = 0; i < selectedOpeningBook.length; ++i) {
      if (allMoves.length > selectedOpeningBook[i].length) continue;
      var maxLength = Math.min(allMoves.length, selectedOpeningBook[i].length);
      if (allMoves.substring(0, maxLength) == selectedOpeningBook[i].substring(0, maxLength)) {
        // Line can be from selectedOpeningBook[i]
        isFromOtherOpening = true;
        candidateOpenings.push(selectedOpeningBook[i]);
      }
    }

    // Or perhaps another opening that isn't selected?
    var isFromOtherNonSelectedOpening = false;
    if (chessy.orientation() == 'white') {
      if (allMoves in whiteLines) {
        isFromOtherNonSelectedOpening = true;
      }
    } else if (chessy.orientation() == 'black') {
      if (allMoves in blackLines) {
        isFromOtherNonSelectedOpening = true;
      }
    }

    if (isFromOtherOpening) {
      srs.loadCandidateLines(candidateOpenings);
      currentLine = srs.getNextLine('');
      //getComments("");
      if (currentLine === null) {
        showMessage('openingneededdlg', 'Note', '130px');
        nextMove = '';
      } else {
        nextMove = getNextMove(chessy.history().join(''), currentLine);
      }
      if (!chessy.isPlayersTurn()) setTimeout(makeOpponentMove, 500);
    } else if (isFromOtherNonSelectedOpening) {
      // showMessage('otheropeningdlg', 'Note', '160px');
      showOtherOpeningMessage(move);
      $("#warning").text("");
      // Show next comment
      var nextComment;
      if (chessy.orientation() == 'white') {
        nextComment = (chessy.history().length + 1) / 2;
      } else {
        nextComment = (chessy.history().length) / 2;
      }
      $("#comment" + nextComment).show();
      return;
    } else {
      // is a bad move
      mistakesCount++;
      setTimeout(undoBadMove, 500);
      $("#warning").text("Not most popular move.");
      perfectLine = false;
      return;
    }
  } 

  $("#warning").text("");
  $('.square-55d63.highlightHint').removeClass('highlightHint');
  $('.square-55d63.highlightLastMove').removeClass('highlightLastMove');
  var move_obj = move;
  $('.square-' + move_obj.from).addClass('highlightLastMove');
  $('.square-' + move_obj.to).addClass('highlightLastMove');
  playSounds(move);
  timesHintAsked = 0;
  nextMove = getNextMove(chessy.history().join(''), currentLine);
  updateOpeningText();

  //displayComments();

  setTimeout(makeOpponentMove, 500);
}

function onSnapEnd() {
  chessy.setPosition(chessy.game.fen());
}

function playSounds(move) {
  if (move.captured) {
    $('#soundTake').get(0).play();
  } else if (chessy.game.in_check()) {
    $('#soundCheck').get(0).play();
  } else {
    $('#soundMove').get(0).play();
  }
}

function undoBadMove() {
  moveBlock = true;
  setTimeout(function(){ moveBlock = false; }, 800);
  chessy.undoPlayerMove();
  timesHintAsked += 1;
  if (timesHintAsked < 3) {
    setTimeout(function(){chessy.hintSmall(nextMove);}, 400);
  } else {
    setTimeout(function(){chessy.hintBig(nextMove);}, 400);
  }
}

function addProgressBar(moves) {
  var idname = opening_book[moves][0].replace(/[^a-zA-Z0-9]/g,"");
  var percentLearnt = 0.0;
  if (chessy.orientation() == 'white') {
    percentLearnt = parseInt((parseFloat(opening_book[moves][3]) / opening_book[moves][1] * 100.0) + 0.5);
  } else if (chessy.orientation() == 'black') {
    percentLearnt = parseInt((parseFloat(opening_book[moves][4]) / opening_book[moves][2] * 100.0) + 0.5);
  }

  if (percentLearnt < 100) {
    $('#' + idname).css('background', 'linear-gradient(90deg, #3f3 ' + percentLearnt + '%, white ' + percentLearnt + '%)');
  } else {
    $('#' + idname).css('background', 'linear-gradient(90deg, #ff0 ' + percentLearnt + '%, white ' + percentLearnt + '%)');
  }
}

function showMessage(id, title, width) {
  $('#' + id).dialog({
    dialogClass: "no-close",
    title: title, 
    zIndex: 10000,
    width: width, resizable: false,
    buttons: {
      OK: function () {
        $(this).dialog("close");
      }
    },
    show: {
      effect: "fade",
      duration: 500
    },
    hide: {
      effect: "fade",
      duration: 500,
    }
  });
}

function showFinishLineMessage() {
  if (mistakesCount == 0) {
    $("#numMistakes").text("no mistakes");
  } else if (mistakesCount == 1) {
    $("#numMistakes").text(mistakesCount + " mistake");
  } else {
    $("#numMistakes").text(mistakesCount + " mistakes");
  }

  $('#finishdlg').dialog({
    // dialogClass: "no-close",
    title: "Done!", 
    zIndex: 10000,
    width: '220px', resizable: false,
    buttons: {
      "Repeat": function () {
        doRepeat = true;
        setTimeout(newGame, 200);
        $(this).dialog("close");
      },
      "Next": function () {
        doRepeat = false;
        setTimeout(newGame, 200);
        $(this).dialog("close");
      }
    },
    show: {
      effect: "fade",
      duration: 500
    },
    hide: {
      effect: "fade",
      duration: 500,
    }
  });
  $(".ui-button.ui-widget.ui-state-default.ui-corner-all.ui-button-icon-only.ui-dialog-titlebar-close").children(".ui-button-text").remove();
  $(".ui-button.ui-widget.ui-state-default.ui-corner-all.ui-button-icon-only.ui-dialog-titlebar-close").prop('title' ,'');

  //showBookAd();
}

function showOtherOpeningMessage(move) {
  $('#otheropeningdlg').dialog({
    dialogClass: "no-close",
    title: "Note", 
    zIndex: 10000,
    width: '160px', resizable: false,
    buttons: {
      "Yes": function () {
        var openingMoves = chessy.game.history().join('');
        var idname = opening_book[openingMoves][0].replace(/[^a-zA-Z0-9]/g,"");

        var allParents = [];
        var parent = opening_book[openingMoves][5];
        while (parent != "0") {
          allParents.push(parent);
          parent = opening_book[parent][5];
        }

        for (var i = allParents.length-1; i >= 0; --i) {
          var parentid = opening_book[allParents[i]][0].replace(/[^a-zA-Z0-9]/g,"");
          var needsToOpen = $("#" + parentid).parent().children(".expander").text() == '+';
          if (needsToOpen) {
            $("#" + parentid).parent().children(".expander").click();
          }
        }

        $("#" + idname).click();

        var allMoves = chessy.game.history().join('');
        var candidateOpenings = [];
        for (var i = 0; i < selectedOpeningBook.length; ++i) {
          if (allMoves.length > selectedOpeningBook[i].length) continue;
          var maxLength = Math.min(allMoves.length, selectedOpeningBook[i].length);
          if (allMoves.substring(0, maxLength) == selectedOpeningBook[i].substring(0, maxLength)) {
            // Line can be from selectedOpeningBook[i]
            isFromOtherOpening = true;
            candidateOpenings.push(selectedOpeningBook[i]);
          }
        }

        srs.loadCandidateLines(candidateOpenings);
        currentLine = srs.getNextLine('');
        //getComments("");
        if (currentLine === null) {
          showMessage('openingneededdlg', 'Note', '130px');
          nextMove = '';
        } else {
          nextMove = getNextMove(chessy.history().join(''), currentLine);
        }

        $("#warning").text("");
        $('.square-55d63.highlightHint').removeClass('highlightHint');
        $('.square-55d63.highlightLastMove').removeClass('highlightLastMove');
        var move_obj = move;
        $('.square-' + move_obj.from).addClass('highlightLastMove');
        $('.square-' + move_obj.to).addClass('highlightLastMove');
        playSounds(move);
        timesHintAsked = 0;
        nextMove = getNextMove(chessy.history().join(''), currentLine);
        updateOpeningText();

        setTimeout(makeOpponentMove, 500);
        $(this).dialog("close");
      },
      "No": function () {
        setTimeout(function(){ undoBadMove(); }, 500);
        mistakesCount++;
        $(this).dialog("close");
      }
    },
    show: {
      effect: "fade",
      duration: 500
    },
    hide: {
      effect: "fade",
      duration: 500,
    }
  });
}

function makeOpponentMove() {
  if (isPlayersTurn()) return;
  if (nextMove === null) return;
  if ($("img").is(':animated')) {
    setTimeout(makeOpponentMove, 500);
    return;
  }

  if (currentLine === null) {
    showMessage('openingneededdlg', 'Note', '130px');
    nextMove = '';
    return;
  }

  var move_obj = chessy.move(nextMove);
  playSounds(move_obj);

  updateOpeningText();

  nextMove = getNextMove(chessy.history().join(''), currentLine);
}

function updateOpeningText() {
  if (chessy.history().join('') in opening_book) {
    currentOpening = opening_book[chessy.history().join('')][0];
    $('#opening').text(currentOpening);
  } else if (chessy.history().join('') == '') {
    currentOpening = '';
    $('#opening').text('');
  }
}

function updateSelectedOpeningBook() {
  selectedOpeningBook = [];
  $('.selected > .openingLineName').each(function(i, obj) {
    var text = $(this).text();
    selectedOpeningBook.push(opening_book_moves[text]);
  });
}

// Helper functions

function splitStringIntoMoves(history) {
  moveArray = [];

  while (history.length > 0) {
    if (history.indexOf('O-O-O') == 0) {
      moveArray.push('O-O-O');
      history = history.substring(5);
      continue;
    } else if (history.indexOf('O-O') == 0) {
      moveArray.push('O-O');
      history = history.substring(3);
      continue;
    }

    digitIndex = 0;
    for (var i = 0; i < history.length; ++i) {
      if (history[i] >= '0' && history[i] <= '9') {
        if ((i > 0 && history[i-1] == 'N') || (i > 0 && history[i-1] == 'R')) continue;
        digitIndex = i;
        break;
      }
    }

    if (history.length > digitIndex + 1) {
      if (history[digitIndex+1] == '+' || history[digitIndex+1] == '#') {
        digitIndex += 1;
      }
    }

    // Check for promotions
    if (history.length > digitIndex + 1) {
      if (history[digitIndex+1] == '=') {
        digitIndex += 2;
      }
    }

    moveArray.push(history.substring(0, digitIndex+1));
    history = history.substring(digitIndex+1);
  }
  return moveArray;
}

function getNextMove(history, line) {
  var futureline = line.substring(history.length);
  var splitMoves = splitStringIntoMoves(futureline);

  if (splitMoves.length == 0) {
    // Game over
    chessy.gameIsOver();
    gameover = true;
    $('#soundSuccess').get(0).play();
    if (!updatedHistory) {
      srs.doneLine(chessy.history().join(''), perfectLine);
      updatedHistory = true;
    }
    if (srs.hasMoreLinesDue(selectedOpeningBook)) {
      setTimeout(showFinishLineMessage, 200);
    } else {
      showMessage('finishdlgnonedue', 'Done!', '130px');
    }
    return null;
  }

  return splitMoves[0];
}

function showBookAd() {
  var adId = Math.floor(Math.random() * bwbads.length);
  var adcode = '<a href="https://web.archive.org/web/20190130125125/http://www.jdoqocy.com/click-8175570-10487484-1399918848000?url=http%3A%2F%2Fwww.betterworldbooks.com%2Fdetail.aspx%3FItemId%3D';
  adcode += bwbads[adId][0];
  adcode += '%26utm_source%3DAffiliate%26utm_campaign%3DText%26utm_medium%3Dbooklink%26utm_term%3D1%26utm_content%3Dproduct" target="_blank"><img src="';
  adcode += bwbads[adId][1];
  adcode += '" style="max-width:100%;max-height:100%;"/></a><img src="https://web.archive.org/web/20190130125125/http://www.tqlkg.com/image-8175570-10487484-1399918848000" width="1" height="1" border="0"/>';
  $("#finishdlgadbox").html(adcode);

  /*var currentOpeningMoves = opening_book_moves[currentOpening];
        var bookID = -1;
        if (chessy.orientation() == 'white') {
                bookID = opening_book[currentOpeningMoves][10][0];
        } else if (chessy.orientation() == 'black') {
                bookID = opening_book[currentOpeningMoves][11][0];
        }*/

  // Show the targeted book 30% of the time, random books 70%
  /*if (bookID != 1) {
                if (Math.random() < 0.7) {
                        bookID = 1;
                }
        }

        if (bookID == 1) {
                var subBookID = Math.floor((Math.random() * 7) + 1); 
                bookID = String(bookID) + "-" + String(subBookID);
        }

        var adimg = books[String(bookID) + '_img'];
        var adframe = books[String(bookID) + '_frame'];
        $("#finishdlgadbox").html(adimg);
        $("#finishdlgad").prop('title', adframe);

        $('#finishdlgad').tooltip({
                content: function() {
                        return $(this).attr('title');
                },
                position: { my: "left+15 center", at: "right center" },
                tooltipClass: "tooltipHint"
        });*/
}

function millisecondsToString(ms) {
  var ret = '';
  if (ms < 1000) {
    ret = ms + " millisecond";
    if (ms > 1) ret += "s";
  } else if (ms < 60000) {
    ret = Math.round(ms / 1000) + " second";
    if (Math.round(ms / 1000 > 1)) ret += "s";
  } else if (ms < 3600000) {
    ret = Math.round(ms / 60000) + " minute";
    if (Math.round(ms / 60000 > 1)) ret += "s";
  } else if (ms < 86400000) {
    ret = Math.round(ms / 3600000) + " hour";
    if (Math.round(ms / 3600000 > 1)) ret += "s";
  } else {
    ret = Math.round(ms / 86400000) + " day";
    if (Math.round(ms / 86400000 > 1)) ret += "s";
  }
  return ret;
}

function isPlayersTurn() {
  if (chessy.orientation() == 'white' && chessy.game.turn() == 'b') return false;
  if (chessy.orientation() == 'black' && chessy.game.turn() == 'w') return false;
  return true;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function shuffle(a) {
  var currentIndex = a.length, temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = a[currentIndex];
    a[currentIndex] = a[randomIndex];
    a[randomIndex] = temporaryValue;
  }
  return a;
}

function unique_array(a) {
  var seen = {};
  return a.filter(function(item) {
    return seen.hasOwnProperty(item.moves) ? false : (seen[item.moves] = true);
  });
}

var entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': '&quot;',
  "'": '&#39;',
  "/": '&#x2F;'
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return entityMap[s];
  });
}

String.prototype.startsWith = function(needle) {
  return(this.indexOf(needle) == 0);
};


// end helper functions

updateSelectedOpeningBook();
srs = new SRS();

srs.updateSRS(retrieveData(srs));

$(window).trigger('resize');
$('body').layout({
  applyDemoStyles: 			false,
  initClosed:					false,
  livePaneResizing:			true,
  closable:					false,
  east__size:					300,
  east__minSize:				100,
  east__maxSize:				600,
  east__slidable:				false,
});

currentLine = srs.getNextLine(selectedOpeningBook);
//getComments("");
nextMove = getNextMove(chessy.history().join(''), currentLine);
setTimeout(showWelcome, 600);
addToolTipToOpening("King's Pawn Opening, General");
addToolTipToOpening("Queen Pawn Opening, General");
addToolTipToOpening("English Opening, General");
addToolTipToOpening("Zukertort Opening, General");
addToolTipToOpening("Hungarian Opening, General");
addToolTipToOpening("Bird Opening, General");
addToolTipToOpening("Van Geet Opening, General");
// addToolTipToOpening("Grob's Attack (Traps)");

preloadBookImages();

$( document ).tooltip();

$(document).ready(function(){
  document.getElementById("hideAll").style.display = "none";
});


}
/*
     FILE ARCHIVED ON 12:51:25 Jan 30, 2019 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 06:43:07 Mar 10, 2024.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  exclusion.robots: 0.094
  exclusion.robots.policy: 0.084
  cdx.remote: 0.091
  esindex: 0.01
  LoadShardBlock: 135.117 (6)
  PetaboxLoader3.datanode: 149.286 (8)
  load_resource: 144.796 (2)
  PetaboxLoader3.resolve: 95.447 (2)
*/
