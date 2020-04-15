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

let _games = {}
//main
module.exports = function(app, io, wordArray) {


//html routing
app.get('/', function(req, res){
  res.sendFile(__dirname +  '/index.html');
});

app.post('/', urlencodedParser, function(req, res){
  //Get maxPlayers from form
  var maxPlayers = req.body.maxPlayers;

  /** TODO: This needs to go to a socket?
  phrase = req.body.phrase;

  //TODO: check if phrase is valid. If not, complain. Remove all uneeded characters.
  regexp = /[A-za-z']+/g
  var result;
  while ((result = regexp.exec(phrase))!=null){
    search = utilFunctions.binarySearch(wordArray, result[0].toLowerCase());
    if (search == -1) return res.redirect('/'); //TODO: change index.html to index.ejs and rerender
  }

  hint = req.body.hint;
  maxPlayers = req.body.hint; */

  //Create random gameId
  gameId = generateGameId();

  //make player 1 cookie with gameId
  player1 = new Player(gameId, 1, randomName())
  player2 = new Player(gameId, 2, randomName())
  player3 = new Player(gameId, 3, randomName())
  res.cookie("token", player1.hash, COOKIE_OPTIONS);

  //if it is, then create a game!

  game = {
    gameId: gameId,
    playerQueue: [player1, player2, player3],
    guessedLetters: "felct",
    phrase: "c_t___",
    hint: "Feline",
    maxPlayers: maxPlayers,
    gamePhase: GAME_PHASE.SELECTION,
    activeGuesser: 1 //active host assumed to be playerQueue[0]
  }

  addGameToDatabase(game);

  res.redirect('/' + gameId);
});

//gameId
app.get("/:gameId([A-Za-z0-9]{6})", function(req, res, next){
  gameId = req.params.gameId.toUpperCase();
  //If game does not exist, return to homepage
  //Else, join!
  if (databaseHasGameById(gameId)){
    game = fetchGameFromDatabase(gameId);
    stripped = strippedGameInfo(game);
    res.render('game',{gameId: gameId});
  } else {
    next();
  }

});//END POST

app.get("/:wordTest", (req, res, next)=>{
  needle = req.params.wordTest.toLowerCase();
  result = utilFunctions.binarySearch(wordArray, needle);
  (result >= 0) ? res.send(needle.toUpperCase() + " is an English word!") : next();
});

//404
app.use(function (req, res, next) {

  res.status(404).send("Sorry can't find that!");
});

//socket routing
io.on('connection', function(socket){
  var gameId = parseGameIdFromSocket(socket);
  if (gameId == undefined) return;
  socket.join(gameId);
  socket.on('send stripped game info', function(id, msg){
    stripped = strippedGameInfo(game);
    socket.emit('reset information', stripped);
  });
})

//user Functions
/**
  * returns undefined if it cannot find the gameId
  * @param {socket} socket - the socket.io object
  */
function parseGameIdFromSocket(socket){
  url = socket.request.headers.referer;
  gameId = url.match(/\/[A-Za-z0-9]{6}\/?$/)[0];
  if (!!gameId){
    return gameId.match(/[^\/]{6}/)[0];
  } else {
    return undefined;
  }
}
/**
  * Genearates a 6-character game id to insert into the database
  */
function generateGameId(){
  let gameId;
  let isInDatabase = true;
  while (isInDatabase){
    gameId =  Math.random().toString(36).substring(3,9).toUpperCase();
    isInDatabase = databaseHasGameById(gameId);
  }
  return gameId;
}

/**
  * Fetches game data from database
  * @param {string} gameId 6-letter string indicating gameId
  */
function fetchGameFromDatabase(gameId){
  return _games[gameId];
}

/**
  * Initialize full game data into database
  * @param {object} game game instance containing game.gameId
  */
function addGameToDatabase(game){
  _games[game.gameId] = game;
}

/**
  * Remove game from database
  * @param {string} gameId
  */
function removeGameFromDatabase(gameId){
  _games.splice(gameId);
}

/**
  * Checks to see if database includes game.
  * @param {string} gameId the string gameId
  */
function databaseHasGameById(gameId){
  return !!_games[gameId]; //javascript double-bang
}
/**
  * Returns the currently rendered phrase of the game
  * e.g. CATS + C, T = C_T_
  * @param {object} game game pulled from database
  */
function renderedPhrase(game){
  result = ""
  phrase = game.phrase.toLowerCase();
  for (var i = 0; i < phrase.length; i++){
    c = phrase.charAt(i);
    if (c.match(/[A-Za-z]/i)) {
      if (game.guessedLetters.includes(c)){
          result += c;
      } else {
        result += '_';
      }
    } else {
      result += c;
    }
  }
  return result;
}

/**
  * strippedGameInfo returns necessary game info for client
  * changes playerQueue to contiain id and nickname only
  * renders the completed phrase - similar to code on client side.
  * @param {objsect} game the game info pulled from database.
  */
function strippedGameInfo(game){
  playerQueue = []
  game.playerQueue.forEach((item)=>{
    playerQueue.push({
      id:item.id,
      nickname: item.nickname});
  });
  phrase = renderedPhrase(game);
  return {
    playerQueue: playerQueue,
    phrase: phrase,
    guessedLetters: game.guessedLetters,
    hint: game.hint,
    gamePhase: game.gamePhase,
    activeGuesser: game.activeGuesser //active host assumed to be playerQueue[0]
  }
}

/**
  * Returns random two-part name like "CornBuvettes"
  */
function randomName(){
  var name;
  for(i=0; i<2;i++){
    index = Math.floor(wordArray.length * Math.random())
    name = name || "";
    word = wordArray[index];
    name = name + word.charAt(0).toUpperCase() + word.slice(1);
  }
  return name;
}

};//END module.exports

var Player = function(gameId, accumulatorID, nickname){
  this.hash = hash(gameId + accumulatorID + SERVER_SALT);
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
