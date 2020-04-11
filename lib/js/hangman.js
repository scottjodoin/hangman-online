//Requires jQuery
//Requires modified jkeyboard
//includes socket.io
//Initialize body part names
var bodyPartNames =[
  ["head", "eyes-open", "mouth-smile"],
  ["body"],
  ["arm1"],
  ["arm2"],
  ["leg1"],
  ["leg2"],
  ["rope"],
  ["head", "eyes-dead", "mouth-frown"],
];

$(document).ready(function() {
  var socket = io();
  var _hangmanLevel = 0;

  //Hides the hangman
  function hideHangman(){
     for (var i=0;i<bodyPartNames.length;i++){
      bodyPartNames[i].forEach((j) => {
        $("#" + j).attr("visibility","hidden");
      });
    }
  };
  hideHangman();

  //When the keyboard is clicked.
  var keyboardOnClick = function(letter){
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
    //End game if > ????
  }

  //Modified jkeyboard to accept a callback function
  $('#keyboard').jkeyboard({
    callBack: keyboardOnClick,
  });
});
