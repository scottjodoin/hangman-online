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
  suffix = window.location.href.replace(/(.*:\/\/)?(.+\.)?/," ").substring(1);
  $(".game-id").val(suffix);
  socket.emit('send stripped game info');
  setErrorMessage("Waiting for server...");
}

socket.on('reset information', function(data){

  setErrorMessage("Received from server.");
   var game = data.game;
   _player = game.playerQueue[data.playerIndex];
   _activeGuesser = game.activeGuesser;
   var isHost = (data.playerIndex == 0);
   var isGuesser = (data.playerIndex == game.activeGuesser);
   if (isGuesser) enableKeyboard();
   if (isHost && game.gamePhase == 0){
     $(".g-overlay").css("display","block");
   } else{
     $(".g-overlay").css("display","none");
   }
   $("#player-name").html(`${_player.nickname} (${_player.id})`);
   replaceNameList(game.playerQueue);
   formatNameList(_activeGuesser);
   replaceHint(game.hint);
   replacePhrase(game.phrase);
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

socket.on('phrase rejected', function(data){
  setErrorMessage("Word and phrase rejected. Please try again.")
});

socket.on('round start', function(data){
  setErrorMessage("Waiting for first guesser...");
  var playerIndex = determinePlayerIndexFromNameList();
  if (playerIndex == 0) overlayOff();
  _activeGuesser = 1; //Always going to be this person at the start of a round.
  formatNameList(_activeGuesser);
  (playerIndex == _activeGuesser) ? enableKeyboard() : disableKeyboard();
});

socket.on('new player', function(data){
  var listItem = `${data.nickname} (${data.playerId})`
  if ( !$("#name-list").html().includes(listItem)){
    $("#name-list").append(`<li id="${data.playerId}">${listItem}</li>`)
  }
});

socket.on('remove player', function(data){
  var $playerElement = $(`#name-data.id`)
  if ($playerElement.length > 0){
    $($playerElement).remove();
  }
  _activeGuesser = data.activeGuesser;
  formatNameList(_activeGuesser);
  (playerIndex == _activeGuesser) ? enableKeyboard() : disableKeyboard();
});

function disableKeyboard(){
  _keyboardEnabled = false;
}
function enableKeyboard(){
  _keyboardEnabled = true;
}
function setErrorMessage(err){
  $("#error-message").html(err);
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
//Get player index using _player
function determinePlayerIndexFromNameList(){
  var playerIndex = -1;
  $('#name-list > li').each((index, element)=>{
    if ($(element).attr('id') == `name-${_player.id}`){
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

//When the keyboard is clicked.
function keyboardOnClick(letter){
  if (_keyboardEnabled){
    var $guessedLetters = $("#guessed-letters-display");
    if (!$guessedLetters.html().includes(letter)) {
      $guessedLetters.append(letter);
      hitHangman();
    }
  }
};

//Remove the body part. Assumes _hanmanLevel >= 0 and < 5
function hitHangman(){
  if (_hangmanLevel == 7){
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
