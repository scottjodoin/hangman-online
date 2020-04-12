//requirements
let bodyParser = require('body-parser');
let urlencodedParser = bodyParser.urlencoded({extended: false});
let utilFunctions = require('./util-functions'); //result = utilFunctions.binarySearch(wordArray, needle);
let hash = require('object-hash');
let cookieParser = require('cookie-parser');

const SERVER_SALT = Math.random().toString().substring(2); //used for encrypting cookies
const COOKIE_OPTIONS = {
  maxAge: 15 * 60 * 1000, //15 minute expiry
  httpOnly: true
}
const GAME_PHASE = {
  SELECTION: 0,
  GUESSING: 1,
}
//main
module.exports = function(app, io, wordArray) {
//homepage
app.get('/', function(req, res){
  res.sendFile(__dirname +  '/index.html');
});

app.post('/', urlencodedParser, function(req, res){
  phrase = req.body.phrase;

  //TODO: check if phrase is valid. If not, complain. Remove all uneeded characters.
  regexp = /[A-za-z']+/g
  var result;
  while ((result = regexp.exec(phrase))!=null){
    search = utilFunctions.binarySearch(wordArray, result[0].toLowerCase());
    if (search == -1) return res.redirect('/'); //TODO: change index.html to index.ejs and rerender
  }

  hint = req.body.hint;
  maxPlayers = req.body.hint;

  //TODO: create random gameID
  gameID = "desBeD";

  //TODO: check to see if gameID is available

  //make player 1 cookie with gameID
  player1 = new Player(gameID, 0, )
  res.cookie("token", player1.hash, COOKIE_OPTIONS);

  //if it is, then create a game!
  game = {
    id: gameID,
    playerQueue: [player1.hash],
    guessedLetters: "",
    phrase: phrase,
    hint: hint,
    maxPlayers: 4,
    gamePhase: GAME_PHASE.SELECTION,
    activeGuesser: -1 //active host assumed to be playerQueue[0]
  }
  res.json(game);
});

//gameID
app.get("/:gameID([A-Za-z]{6})", function(req, res){
  gameID = req.params.gameID;
  //If game does not exist, return to homepage
  //Else, join!
  res.send(gameID);
});

app.get("/:wordTest", (req, res, next)=>{
  needle = req.params.wordTest.toLowerCase();
  result = utilFunctions.binarySearch(wordArray, needle);
  (result >= 0) ? res.send(needle.toUpperCase() + " is an English word!") : next();
});

//404
app.use(function (req, res, next) {

  res.status(404).send("Sorry can't find that!");
});

//User Functions
var randomName = function(){
  for(i=0; i<2;i++){
    index = Math.floor(wordArray.length * Math.random())
    name = name + "_" + wordArray[index] || wordArray[index];
  }
  return name;
}

};

var Player = function(gameID, accumulatorID, nickname){
  this.hash = hash(gameID + accumulatorID + SERVER_SALT);
  this.id = accumulatorID;
  this.nickname = nickname;
};
var player1 = {hash: "20rsndjfaskbf32wasdfiawodjf", id: "145935", nickname: "Jimmy", color: "#444"};
var player2 = {hash: "sadfh4asd9f0asdjf32Wsdfh32s", id: "347923", nickname: "Kim", color: "#222"};
var players = {player1, player2};
var Game = function(id, playerQueue, guessedLetters, phrase, hint, maxPlayers, activeGuesser){
  this.id = id;
  this.playerQueue = playerQueue;
  this.guessedLetters = guessedLetters;
  this.phrase = phrase;
  this.hint = hint;
  this.maxPlayers = maxPlayers;
  this.activeGuesser = activeGuesser;
};

var games = [{
id: 'pEsudV',
playerQueue: [player1, player2],
guessedLetters: "",
phrase:"What happened to all the potatoes?",
hint:"Baman Piderman Quote",
maxPlayers: 4,
activeGuesser: 1
}];
