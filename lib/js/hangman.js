//Requires jQuery
//Requires modified jkeyboard
//includes socket.io
//Initialize body part names
;var bodyPartNames =[
  ["head", "eyes-open", "mouth-smile"],
  ["body"],
  ["arm1"],
  ["arm2"],
  ["leg1"],
  ["leg2"],
  ["rope"],
  ["head", "eyes-dead", "mouth-frown"],
];

$(document).ready(function(){

//no parameters please.
var url = window.location.href;
if (url.includes("?")){
window.location.href = url.split('?')[0];
}

var socket = io();
var _hangmanLevel = 0;
hideHangman();

//Get _gameId from url
var _keyboardEnabled = false;
var _gameId = window.location.href.match(/\/[A-Za-z0-9]{6}\/?$/)[0] || "";
var _gameId = _gameId.match(/[^\/]{6}/)[0] || "";
var _player = "";
var _activeGuesser = -1;
//Modified jkeyboard to accept a callback function
$('#keyboard').jkeyboard({
  callBack: keyboardOnClick,
});

$('form').submit(function(e){
  e.preventDefault(); //prevents page reloading
  hint = $('#hint-input').val();
  phrase = $('#phrase-input').val();
  socket.emit('hint and phrase try', {hint: hint, phrase: phrase});

});

//If in a game url (e.g. /sfd4Es ), request the full game.
if (_gameId){
  //regex gets rid of first bit to make it shorter.
  suffix = window.location.href.replace("https://","");
  $(".game-id").val(suffix);
  setErrorMessage("Waiting for server...");
}

socket.on('set cookie', (data, playersOnline)=>{
  Cookies.set('token', data.value, data.options);
  setPlayersOnline(playersOnline);
  location.reload();
})

socket.on('reload', function (data, playersOnline) {
    location.reload();
    setPlayersOnline(playersOnline);
});

socket.on('reset information', (data, playersOnline)=>{
   setPlayersOnline(playersOnline);
   setErrorMessage("Received from server.");
   var game = data.game;
   _player = game.playerQueue[data.playerIndex];
   _activeGuesser = game.activeGuesser;
   var isHost = (data.playerIndex == 0);
   var isGuesser = (data.playerIndex == game.activeGuesser);
   if (isGuesser) enableKeyboard();
   if (isHost && game.gamePhase == 0){
     overlayOn();
   } else{
     overlayOff();
   }
   $("#player-name").html(`${_player.nickname} (${_player.id})`);
   replaceNameList(game.playerQueue);
   formatNameList(_activeGuesser);
   replaceHint(game.hint);
   replacePhrase(game.phrase || "&nbsp");
   replaceGuessedLetters(game.guessedLetters || "&nbsp");
   var incorrectGuesses = calculateIncorrectGuessesFromGuessedLetters(game.guessedLetters);
   hideHangman();
   for (var i = 0; i < incorrectGuesses; i++){
     hitHangman();
   }
   //Set the player instructions
   var message = ""
   var selectionPhase = (game.gamePhase == 0)
   var guessingPhase = (game.gamePhase == 1)
   //If the player is the host
   if (selectionPhase){
     if (isHost){
       message = "Other player(s) waiting for your choice..."
     }else{
       message = "Waiting for host to choose..."
     }
   } else if (guessingPhase){
     if (isGuesser){
       message = "Please choose a letter."
     } else {
       message = "Other player choosing a letter..."
     }
   }
   setErrorMessage(message);
  });

socket.on('phrase rejected', (playersOnline)=>{
  setPlayersOnline(playersOnline);
  $("#overlay-word-rejected").css("display","block");
  setErrorMessage("Word and phrase rejected. Please try again.")
});

socket.on('round start', (data, playersOnline)=>{
  setPlayersOnline(playersOnline);
  $('#hint-display').text(data.hint);
  $('#phrase-display').text(data.phrase);
  $('#guessed-letters-display').text("");
  var playerIndex = determinePlayerIndexFromNameList(_player.id);
  if (playerIndex == 0) overlayOff();
  _activeGuesser = 1; //Always going to be this person at the start of a round.
  formatNameList(_activeGuesser);
  if (playerIndex == _activeGuesser){
    setErrorMessage("Please choose a letter.");
    enableKeyboard();
  } else {
    setErrorMessage("Waiting for first guesser...");
    disableKeyboard();
  }
});

socket.on('new player', (data, playersOnline)=>{
  setPlayersOnline(playersOnline);
  var listItem = `${data.nickname} (${data.playerId})`
  if ( !$("#name-list").html().includes(listItem)){
    $("#name-list").append(`<li id="name-${data.playerId}">${listItem}</li>`)
  }
});

socket.on('remove player', (data, playersOnline)=>{
  setPlayersOnline(playersOnline);
  if (data.id < 0) return;
  var removedIndex = determinePlayerIndexFromNameList(data.id);
  $(`#name-list li:nth-child(${removedIndex + 1})`).remove();
  _activeGuesser = data.activeGuesser;
  formatNameList(_activeGuesser);
  if (removedIndex === 0){
    //Host left! New host.
    setErrorMessage("Host left! Starting new round...");
    setupNewRound();
  } else { // Just a guesser has left.
    var playerIndex = determinePlayerIndexFromNameList(_player.id);
      (playerIndex === _activeGuesser) ? enableKeyboard() : disableKeyboard();
    }
});

socket.on('correct letter', (data, playersOnline)=>{
  setPlayersOnline(playersOnline);
  var playerIndex = determinePlayerIndexFromNameList(_player.id);

  //update Phrase
  $("#phrase-display").text(data.phrase);
  _activeGuesser = data.activeGuesser;
  if (playerIndex === _activeGuesser){
    setErrorMessage("Please choose a letter.");
    enableKeyboard();
  } else {
    var activeName = getActiveGuesserAsPlayer().nickname;
    setErrorMessage( activeName + "'s turn to guess.")
    disableKeyboard();
  }
});

socket.on('incorrect letter', (data, playersOnline)=>{
  setPlayersOnline(playersOnline);
  var playerIndex = determinePlayerIndexFromNameList(_player.id);
  $("#guessed-letters-display").append(data.letter);
  _activeGuesser = data.activeGuesser;
  if (playerIndex === _activeGuesser){
    setErrorMessage("Please choose a letter.");
    enableKeyboard();
  } else {
    var activeName = getActiveGuesserAsPlayer().nickname;
    setErrorMessage( activeName + "'s turn to guess.")
    disableKeyboard();
  }
  hitHangman();
});

socket.on("game won", (data, playersOnline)=>{
  setPlayersOnline(playersOnline);
  $("#phrase-display").text(data.phrase);
  var playerIndex = determinePlayerIndexFromNameList(_player.id);
  if (playerIndex === 0){
    setErrorMessage("Round ended. Players guessed your phrase!");
  } else{
    setErrorMessage("Congratulations! You guessed the phrase!");
  }
  _activeGuesser = -1;
  disableKeyboard();
});

socket.on("game lost", (data, playersOnline)=>{
  setPlayersOnline(playersOnline);
  $("#phrase-display").text(data.phrase);
  $("#guessed-letters-display").append(data.letter);
  var playerIndex = determinePlayerIndexFromNameList(_player.id);
  hitHangman();
  if (playerIndex === 0){
    setErrorMessage("Round ended. Players counld't guess your phrase!");
  } else{
    setErrorMessage("You lose. You could not guess the phrase!");
  }
  _activeGuesser = -1;
  disableKeyboard();
})

socket.on("rotate and new round", (playersOnline)=>{
  setPlayersOnline(playersOnline);
  rotateNameList(()=>{
    formatNameList(_activeGuesser);
    setupNewRound();
  });
});//Sockets end.

// Sets up page for a new round based on _player.id
function setupNewRound(){
  _hangmanLevel = 0;
  hideHangman();
  var playerIndex = determinePlayerIndexFromNameList(_player.id);
  if (playerIndex == 0){
    $("#hint-input").val("");
    $("#phrase-input").val("");
    overlayOn();
    $("#hint-input").focus();
  } else {
    setErrorMessage("Waiting for host...");
  }
}

//User Functions


function setPlayersOnline(playersOnline){
  if (typeof playersOnline != "number"){
    return;
  }
  $(".g-player-count").text(
    $(".g-player-count").text().replace(/[0-9]+/,"") +
    playersOnline
    );
}


async function rotateNameList(callBack){
  var prev = $("#name-list li:first-child");
  $.unique(prev).each(function(i) {
    $(this).delay(i * 600).slideUp(function() {
      $(this).appendTo(this.parentNode).slideDown();
    });
  });
  setTimeout(callBack,1000);
}

function disableKeyboard(){
  _keyboardEnabled = false;
}
function enableKeyboard(){
  _keyboardEnabled = true;
}

function setErrorMessage(err){
  $(".error-message").html(err);
}

function calculateIncorrectGuessesFromGuessedLetters(guessedLetters){
  var phrase = $("#phrase-display").html();
  var incorrectGuesses = 0;
  for (var i = 0; i< guessedLetters.length; i++){
    char = guessedLetters.charAt(i);
    if (!phrase.includes(char)) incorrectGuesses += 1;
  }
  return incorrectGuesses;
}

function replaceHint(hint){
  $("#hint-display").html(hint);
}

function replacePhrase(phrase){
  $("#phrase-display").html(phrase);
}

function replaceGuessedLetters(guessedLetters){
  $("#guessed-letters-display").html(guessedLetters)
}

//Determines active player name using name list and _activeGuesser
function getActiveGuesserAsPlayer(){
  if (_activeGuesser < 1) return "Nobody?";
  var line = $(`#name-list li:nth-child(${_activeGuesser + 1})`).text();
  var player = {
    nickname: line.match(/[A-Za-z]+/)[0],
    id: line.match(/[0-9]+/)[0]
  }
  return player;
}

//Get player index using player id
function determinePlayerIndexFromNameList(playerId){
  var playerIndex = -1;
  $('#name-list > li').each((index, element)=>{
    if ($(element).attr('id') == `name-${playerId}`){
      playerIndex = index;
      return;
    }
  });
  return playerIndex;
}
//Refresh the name list
function replaceNameList(playerQueue){
  $("#name-list").empty();
  for (var i = 0; i < playerQueue.length; i++){
    player = playerQueue[i];
    //<p id="name-53263">DeliciousMango</p>
    var line = `${player.nickname} (${player.id})`;
    var id = `name-${player.id}`
    line = `<li id="${id}">${line}</li>`;
    $("#name-list").append(line);
  }
}
function formatNameList(activeGuesser){
  $('#name-list > li').each((index, element)=>{
    $(element).css("font-weight",
      (index==0) ? "bold" : "normal");//host is always on top.
    $(element).css("font-style",
      (index==activeGuesser) ? "oblique" : "normal");//guesser
    $(element).text($(element).text().replace("→ ", ""));
    if (index == activeGuesser){
      $(element).text("→ " + $(element).text());
      $(element).animate({"margin-left": '10px'}, "fast");
      $(element).animate({"margin-left": '0px'}, "fast");
    }

  });
}

//Hides the hangman
function hideHangman(){
   for (var i=0;i<bodyPartNames.length;i++){
    bodyPartNames[i].forEach((j) => {
      $("#" + j).attr("visibility","hidden");
    });
  }
};

//When the onscreen keyboard is clicked.
function keyboardOnClick(letter){
  if (_keyboardEnabled){
    var guessedLetters = $("#guessed-letters-display").text().toUpperCase();
    if (!guessedLetters.includes(letter)) { //Don't allow already-done letters...
        socket.emit('letter try', letter);
    }
  }
};

//When a physical keyboard is clicked.
document.onkeypress = function(e) {
  e = e || window.event;
  if (!/^Key[A-Z]$/.test(e.code) || !_keyboardEnabled) return;
  var letter = e.code.charAt(3);
  var guessedLetters = $("#guessed-letters-display").text().toUpperCase();
  if (!guessedLetters.includes(letter)) { //Don't allow already-done letters...
      socket.emit('letter try', letter);
  }

}

//Remove the body part. Assumes _hanmanLevel >= 0 and < 5
function hitHangman(){
  if (_hangmanLevel >= 7){
    hideHangman();
    _hangmanLevel = 0;
    return;
  }

  //Show body part
  bodyPartNames[_hangmanLevel].forEach((elem)=>{
    $("#" + elem).attr("visibility","visibile");
  });
  _hangmanLevel += 1;
  if (_hangmanLevel == 7){
    bodyPartNames[0].forEach((elem)=>{
        $("#" + elem).attr("visibility","hidden");
    })
    bodyPartNames[7].forEach((elem)=>{
        $("#" + elem).attr("visibility","visible");
    })
  }

  //Increase _hangmanLevel
  //TODO: End game if > ????
}


});//END $
