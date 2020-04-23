let express = require('express');
let  fs = require('fs');
let app  = express();

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
var server = app.listen(port);
var io = require('socket.io').listen(server);
var cookieParser = require('cookie-parser');
let hangmanController = require('./hangman-controller');
const wordArray = fs.readFileSync(__dirname + "/words.txt", 'utf8').split('\n'); //added contractions, too

// set up express and socket.io cookies
app.use(cookieParser());

//No need to use HTTPS, and lying is annoying.
app.use(function(req, res, next) {
  if(req.secure) {
    return res.redirect(['http://', req.get('Host'), req.url].join(''));
  }
  next();
});

// Filter out fb and google spiders.
app.use('/robots.txt', function (req, res, next) {
    res.type('text/plain')
    res.send("User-agent: *\nAllow: /\nDisallow: /*");
});

// Manifest JSON
app.use('/manifest.json', function (req, res, next){
  res.type('text/json');
  res.sendFile(__dirname + "/manifest.webmanifest")
});


// Set up template engine
app.set('view engine', 'ejs');

// Static files
app.use(express.static('./lib'));


// Fire controllers
hangmanController(app, io,  wordArray);

// Listen on port 3000

console.log("listening on port " + port);
