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

//Get gameId from url
gameId = window.location.href.match(/\/[A-Za-z0-9]{6}\/?$/)[0] || "";
gameId = gameId.match(/[^\/]{6}/)[0] || "";

//Modified jkeyboard to accept a callback function
$('#keyboard').jkeyboard({
  callBack: keyboardOnClick,
});

$('form').submit(function(e){
  e.preventDefault(); //prevents page reloading
  hint = $('#hint-input').val();
  phrase = $('#phrase-input').val();
  socket.emit('hint and phrase try', {hint: hint,phrase: phrase})
});

//If in a game url (e.g. /sfd4Es ), request the full game.
if (gameId){
  //regex gets rid of first bit to make it shorter.
  str = window.location.href.replace(/(.*:\/\/)?(.+\.)?/," ").substring(1);
  window.alert(str);
  $(".game-id").val(str);
  socket.emit('send stripped game info');
}

socket.on('reset information', function(game){

   replaceNameList(game.playerQueue);
   formatNameList(game.activeGuesser);
   replaceHint(game.hint);
   replacePhrase(game.phrase);
   replaceGuessedLetters(game.guessedLetters || "&nbsp");
   var incorrectGuesses = calculateIncorrectGuessesFromGuessedLetters(game.guessedLetters);
   hideHangman();
   for (var i = 0; i < incorrectGuesses; i++){
     hitHangman();
   }
  });

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
  $('input#phrase-input').val(letter);
  hitHangman();
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
