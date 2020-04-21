//requirements
let bodyParser = require('body-parser');
let urlencodedParser = bodyParser.urlencoded({extended: false});
let hash = require('object-hash');
let utilFunctions = require('./util-functions'); //result = utilFunctions.binarySearch(wordArray, needle);
let cookie = require('cookie');
const SERVER_SALT = Math.random().toString().substring(2); //used for encrypting cookies
const COOKIE_OPTIONS = {
  maxAge: 15 * 60 * 1000, //15 minute expiry
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

  //Create random gameId
  var gameId = generateGameId();

  //if it is, then create a game!

  game = {
    id: gameId,
    playerQueue: [],
    guessedLetters: "",
    phrase: "",
    hint: "",
    maxPlayers: maxPlayers,
    gamePhase: GAME_PHASE.SELECTION,
    activeGuesser: -1 //set to 1 when second player joins.
  }

  setGameInDatabase(game);

  res.redirect('/' + gameId);
});

//gameId
app.get("/:id([A-Za-z0-9]{6})", function(req, res, next){
  //parse gameId
  gameId = req.params.id.toUpperCase();
  if (databaseHasGameById(gameId)){
    var game = fetchGameFromDatabase(gameId);
    var player;
    var token = req.cookies.token;
    if (token === undefined) {
      // no token: make a new player and add it!
      if (game.playerQueue.length >= game.maxPlayers){
        res.send("Room full.");//No room left
        return;
      };
      player = addNewPlayerAndReturn(game);
      res.cookie('token', player.token, {maxAge: 50 * 1000, httpOnly: true});
      setGameInDatabase(game);//TODO: asyncronous
    } else {
      //yes token: fetch player
      var player = getPlayerUsingToken(token, game);
      if (player === "Not Found!"){//Bad cookie.
        player = addNewPlayerAndReturn(game);//TODO: Is there a way to not have copied code from above?
        res.cookie('token', player.token, {maxAge: 15 * 60 * 1000, httpOnly: true});
        setGameInDatabase(game);//TODO: asyncronous
      }
    }
    //send only the necessary information
    var stripped = strippedPlayerAndGameInfo(player, gameId);
    res.render('game', stripped);
  } else {
    next();

  }
});//END POST

//404
app.use(function (req, res, next) {

  res.status(404).send("Sorry can't find that!");
});

//socket routing
io.on('connection', function(socket){
  if (!validateSocket(socket)){return "Bad Socket."};
  var _gameId = parseGameIdFromSocket(socket);

  socket.join(_gameId, function(){
    var token = getPlayerTokenFromSocket(socket);
    if (typeof token !== "string" || token.length !== 40 ||
      /[^a-z0-9]/.test(token)) {return "Bad token!"};
    console.log("token joined:" + token)
    var game = fetchGameFromDatabase(_gameId);
    var player = getPlayerUsingToken(token, game);
    if (player === "Not Found!") {
      socket.leave(_gameId,()=>{return;});
      socket.disconnect(true);
      return;
    }
    incrementPlayerInstanceByToken(token, game, 1);
    var playerId = player.id;
    var nickname = player.nickname
    socket.to(_gameId).emit('new player', {playerId: playerId, nickname: nickname});
    console.log(nickname + ' joined room ' + _gameId);
  });
  //Determine the token

  socket.on('send stripped game info', function(msg){
    if (!validateSocket(socket)){return "Bad Socket."};
    var data =getPlayerAndGameFromSocket(socket);
    var game = data.game;
    var player = data.player;
    var stripped = strippedPlayerAndGameInfo(player, _gameId);
    socket.emit('reset information', stripped);
  });


  socket.on('hint and phrase try', function (msg){
    if (!validateSocket(socket)){return "Bad Socket."};
    // Accept only from host, reject or start round
    var data = getPlayerAndGameFromSocket(socket);
    var game = data.game;
    var player = data.player;
    if (player !== game.playerQueue[0]){
      return "Rejected";
    }

    // Validate input
    hint = msg.hint;
    phrase = msg.phrase;
    if (typeof hint !== "string" || hint.length < 0 || hint.length > 27 ||
      /^[^a-zA-Z'!@#$%^&*()0-9 ]+$/.test(hint))
       { socket.emit('phrase rejected'); return;}
    if (typeof phrase !== "string" || phrase.length < 1 || phrase.length > 27 ||
      /^[^a-zA-Z' ]+$/.test(phrase))
      { socket.emit('phrase rejected'); return;}
    hint = hint.toLowerCase();
    phrase = phrase.toLowerCase();

    var regexp = /[a-z']+/g
    var result;
    while ((result = regexp.exec(phrase))!=null){
      search = utilFunctions.binarySearch(wordArray, result[0]);
      if (search == -1){
        socket.emit('phrase rejected');
        return;
      }
    }

    console.log(`${game.id}: ${player.nickname} tried |${hint}| and |${phrase}|`)

    game.guessedLetters = "";
    game.hint = hint;
    game.phrase = phrase;
    game.gamePhase = GAME_PHASE.GUESSING;
    game.activeGuesser = 1;//The first person aside from the host...
    setGameInDatabase(game);
    var renderedPhrase = getRenderedPhraseFromGame(game);
    io.in(_gameId).emit('round start', {hint: hint, phrase: renderedPhrase, activeGuesser: game.activeGuesser});
  });

  socket.on('letter try', function (letter){
    if (!validateSocket(socket)){return "Bad Socket."};
    if (typeof letter !== "string" || letter.length !== 1 ||
      /[^A-Za-z]/.test(letter)) { return "Rejected";}

    var data;
    try{
      data = getPlayerAndGameFromSocket(socket);
      if (data.player !== data.game.playerQueue[data.game.activeGuesser]) return;
    } catch(err){return};
    if (letter.match(/[^A-za-z]{1}$/)) return "Rejected."; //has to be a letter
    var player = data.player;
    var game = data.game;
    var phrase = data.game.phrase.toLowerCase();
    letter = letter.toLowerCase();
    if (game.guessedLetters.includes(letter)) return;//No penalty if guessed
    game.guessedLetters += letter;
    console.log(`${data.player.nickname} tried ${letter}: Guessed letters: ${data.game.guessedLetters}`);

    //advance player
    var activeGuesser = getNewActiveGuesserIndex(game);

    // check letters and emit.
    if (phrase.includes(letter)){
      // good letter
      var renderedPhrase = getRenderedPhraseFromGame(game);
      if (renderedPhrase === game.phrase){
        // renderedPhrase!
        io.in(game.id).emit('game won', {
          phrase: game.phrase
        });
        setTimeout(()=>{
          game = resetGame(game);
          game = rotateQueueAndReturnGame(game);
          setGameInDatabase(game);
          io.in(game.id).emit('rotate and new round');
        },1000);
      } else {
        io.in(game.id).emit('correct letter',
        {phrase: getRenderedPhraseFromGame(game), activeGuesser:activeGuesser});
      }

    } else {
      // bad letter
      var incorrectLetters = getIncorrectGuesses(game);
      console.log(incorrectLetters);
      if (incorrectLetters >= 7){
        // end game
        io.in(game.id).emit('game lost', {letter:letter, phrase: game.phrase});
        setTimeout(()=>{
          game = resetGame(game);
          game = rotateQueueAndReturnGame(game)
          setGameInDatabase(game);
          io.in(game.id).emit('rotate and new round');
        }, 1000);
      } else {
        io.in(game.id).emit('incorrect letter',
        {letter:letter, activeGuesser:activeGuesser});
      }
    }
  });
  socket.on('disconnect', function(){
    if (!validateSocket(socket)){return "Bad Socket."};
    var data = getPlayerAndGameFromSocket(socket);
    var game = data.game;
    var player = data.player;
    var timeoutLength = 30*1000;
    setTimeout(()=>{
      var playerInstances = incrementPlayerInstanceByToken(data.player.token,
        game, -1);
      if (playerInstances <= 0){
        //Remove player and update the activeGuesser
        var updatedGame = removePlayerFromGame(data.player, data.game);
        socket.in(data.game.id).emit('remove player',
        {id: data.player.id,
          activeGuesser: updatedGame.activeGuesser});
        socket.leave(game.id);
        console.log(`${data.player.nickname} left room  ${_gameId}. `+
        ` Instances: ${playerInstances}`);

        // Room empty, remove game from database
        if (updatedGame.playerQueue.length === 0){
          removeGameFromDatabase(game.id);
          console.log(`${updatedGame.id} game removed.`)
          return;
        }
      }
    },timeoutLength);

  })
});

// User Functions

function validateSocket(socket){
  if (typeof socket !== "object" || typeof socket.request !== "object" ||
    typeof socket.request.headers !== "object" ||
    typeof socket.request.headers.referer !== "string"){
      return false;
    };
 /*
  var url = socket.request.headers.referer;
  if (url.length < 6 || url.length > 51 ||
    /[^A-Za-z0-9:\.-\/]/.test(url)){
      console.log("Socket: Invalid url:" + url);
      return false;
    }
  var pathname = (new URL(url)).pathname.replace('/','');
  if (pathname.length !== 6 || /[^A-Za-z0-9]/.test(pathname)){
    console.log("Socket: Invalid pathname.");
    return false;
  }

  if (typeof socket.handshake !== "object" ||
  typeof socket.handshake.headers !== "object" ||
  typeof socket.handshake.headers.cookie !== "string"){
    console.log("Socket: Missing cookies");
    return false;
  }
  //*/
  return true;
}

function logError(err){
  console.log(`Error: ${err}`);
}
//Resets essential variables and returns game.
function resetGame(game){
  game.gamePhase = GAME_PHASE.SELECTION;
  game.guessedLetters = "";
  return game;
}
/**
  * Increments the instance count of the player and returns game;
  * @param {string} token - the  token for each browser.
  * @param {Object} game - the game object including playerQueue
  * @param {int} change - +1 or -1
  */
function incrementPlayerInstanceByToken(token, game, change){
  if (!token || !game) return;
  for (var i = 0, length = game.playerQueue.length;
  i < length; i++){
    player = game.playerQueue[i];
    if (player.token == token){
      player.instances += change;
      game.playerQueue[i] = player;
      setGameInDatabase(game);
      return player.instances;
    }
  }
}

function getIncorrectGuesses(game){
  var phrase = game.phrase;
  var guessedLetters = game.guessedLetters;
  var incorrectGuesses = 0;
  for (var i = 0, length = guessedLetters.length; i < length; i++){
    char = guessedLetters.charAt(i);
    if (!phrase.includes(char)) incorrectGuesses += 1;
  }
  return incorrectGuesses;
}

function rotateQueueAndReturnGame(game){
  var playerQueue = game.playerQueue;
  var temp = playerQueue.shift();
  playerQueue.push(temp);
  game.playerQueue = playerQueue;
  return game;
}

//Sets the next player in the game, returns game
function getNewActiveGuesserIndex(game)
{
  game.activeGuesser = (game.activeGuesser + 1) % game.playerQueue.length;
  if (game.activeGuesser === 0) game.activeGuesser = 1;
  return game.activeGuesser;
}

//Gets the player and game using socket url and cookies
function getPlayerAndGameFromSocket(socket){
  var gameId = parseGameIdFromSocket(socket);
  var token = getPlayerTokenFromSocket(socket);
  var game = fetchGameFromDatabase(gameId);
  var player = getPlayerUsingToken(token, game);
  if (player === "Not found!") return "Player not found.";
  return {player: player, game: game};
}

//Return the id of the player with with matching token.
function getPlayerUsingToken(token, game){
  var result = "Not Found!";
  if (!game) return result;
  game.playerQueue.forEach((player)=>{
    if (token === player.token) result = player;
  });
  return result;
}

//Returns undefined if no token found.
  function getPlayerTokenFromSocket(socket){
    return cookie.parse(socket.handshake.headers.cookie).token;
  }

/**
  * Updates game in database and gets the new activeGuesser.
  * Logic for activeGuesser is tricky due to splice and nature of game.
  * Host cannot be guesser, and if no. of players < 2, -1.
  */
function removePlayerFromGame(player, game){
  var playerQueue = game.playerQueue;
  var index = playerQueue.indexOf(player)
  if (index == -1) `node --trace-uncaught ...` + ": player not found";
  playerQueue.splice(index, 1);
  if (index == 0){
    // Host left! Start new round.
    game.activeGuesser = 1;
    game = resetGame(game);
  } else if (game.activeGuesser > playerQueue.length){
    game.activeGuesser = 1;
  } else if (game.activeGuesser > index){
    game.activeGuesser -= 1;
  }// else keep the index!

  //If there's only two players... no active guesser.
  if (playerQueue.length < 2){
    game.activeGuesser = -1;
  }
  console.log(`${playerQueue.length} - removed 1 player.`)
  game.playerQueue = playerQueue;
  setGameInDatabase(game)
  return game;
}

/**
  * Returns undefined if the room is full.
  * Otherwise returns unique player appended to room.
  * @param{string} gameId
  */
function addNewPlayerAndReturn(game)
{
  var gameId = game.id;
  var playerQueue = game.playerQueue;
  if (playerQueue.length == game.maxPlayers){
    return undefined;
  };
  //Find new playerId by incrementing
  var max = -1;
  playerQueue.forEach((player)=>{
    if (player.id > max) max = player.id;
  })
  var playerId = max + 1;
  var nickname = randomName();
  var player = new Player(gameId, playerId, nickname);
  playerQueue.push(player);
  return player;
}

/**
  * returns undefined if it cannot find the gameId
  * @param {socket} socket - the socket.io object
  */
function parseGameIdFromSocket(socket){
  var pathname = new URL(socket.request.headers.referer).pathname;
  pathname = pathname.split('/');
  if (pathname.length == 0) return "Rejected";
  return pathname[1].toUpperCase();
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
  * @param {object} game game instance containing game.id
  */
function setGameInDatabase(game){
  _games[game.id] = game;
}

/**
  * Remove game from database
  * @param {string} gameId
  */
function removeGameFromDatabase(gameId){
  if (gameId in _games){
    delete _games[gameId];
  }
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
function getRenderedPhraseFromGame(game){
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
  return result.toLowerCase();
}

function strippedPlayerAndGameInfo(player, gameId){
  var game = fetchGameFromDatabase(gameId);
  var playerIndex = game.playerQueue.indexOf(player);
  var strippedGame = strippedGameInfo(game);
  return {playerIndex: playerIndex, game: strippedGame};
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
  phrase = getRenderedPhraseFromGame(game);
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


//Schema and Object Definitions

var Player = function(gameId, playerId, nickname){
  this.token = hash(gameId + playerId + SERVER_SALT);
  this.id = playerId;
  this.nickname = nickname;
  this.instances = 0;//When initialized, there will be one!
};

const socketSchema = {
  request: {
    headers: {
      referer: {
        type: "string",
        minLength: 6,
        maxLength: 42,
        pattern: /^[A-Za-z0-9.-\/]+$/,
      }
    }
  }
}
const playerSchemaSimple = {
  id: {
    type: "string",
    minLength: 1,
    maxLength: 2,
    pattern: /^\d+$/,
  },
  nickname: {
    type: "string",
    minLength: 2,
    maxLength: 40,
    pattern: /^[A-Za-z']+$/
  },
}

const playerSchema = {

  token: {
    type: "string",
    minLength: "40",
    maxLength: "40",
    pattern: /^[a-z0-9]+$/
  },
  instances: {
    type: "number",
    min: 0,
    max: 5,
  }
}


const phraseSchema = {
  type: "string",
  minLength: 2,
  maxLength: 27,
  pattern: /^[a-zA-Z' ]+$/
}
