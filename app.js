let express = require('express');
let app  = express();
let  fs = require('fs');
var hangmanController = require('./hangman-controller');
const wordListPath = require('word-list');
const wordArray = fs.readFileSync(wordListPath, 'utf8').split('\n'); //added contractions, too

//set up template engine
app.set('view engine', 'ejs');

//static files
app.use(express.static('./public'));

//cookie controllers

//fire controllers
hangmanController(app, wordArray);

//listen on port 3000
app.listen(3000);
console.log("listening on port 3000");
