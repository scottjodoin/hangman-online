//FINISHED: Making the SVG hangman function and the overlay input.
//NEXT: Change the routing of the submit button through ws? Or should it stay as post?
//NEXT:Change index.html to index.ejs and render the view properly in 'previews'. Change the url route.
let express = require('express');
let app  = express();
let  fs = require('fs');
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
var server = app.listen(port);
var io = require('socket.io').listen(server);
var cookieParser = require('cookie-parser');
let hangmanController = require('./hangman-controller');
const wordArray = fs.readFileSync(__dirname + "/words.txt", 'utf8').split('\n'); //added contractions, too

//set up express and socket.io cookies
app.use(cookieParser());

//set up template engine
app.set('view engine', 'ejs');

//static files
app.use(express.static('./lib'));


//fire controllers
hangmanController(app, io,  wordArray);

//listen on port 3000

console.log("listening on port " + port);
