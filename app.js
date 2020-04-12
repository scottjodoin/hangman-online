//FINISHED: Making the SVG hangman function and the overlay input.
//NEXT: Change the routing of the submit button through ws? Or should it stay as post?
//Change index.html to index.ejs and render the view properly in 'previews'. Change the url route.
let express = require('express');
let app  = express();
let  fs = require('fs');
var server = app.listen(3000);
var io = require('socket.io').listen(server);
let hangmanController = require('./hangman-controller');
const wordListPath = require('word-list');
const wordArray = fs.readFileSync(wordListPath, 'utf8').split('\n'); //added contractions, too

//set up template engine
app.set('view engine', 'ejs');

//static files
app.use(express.static('./lib'));

io.on('connection',function(socket){
  console.log("connected to the socket...");
})

//fire controllers
hangmanController(app, io,  wordArray);

//listen on port 3000

console.log("listening on port 3000");
