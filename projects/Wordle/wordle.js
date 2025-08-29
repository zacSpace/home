var height = 8; //number of guesses
var width = 7; //length of word

var row =0; //current attempt number
var col =0; //current letter for attempt

var gameOver=false;
const words = [
    "ACCOUNT",
    "BALANCE",
    "CABINET",
    "DIGITAL",
    "EXAMPLE",
    "FANTASY",
    "GALLERY",
    "HARVEST",
    "IMAGINE",
    "JUSTICE",
    "KINGDOM",
    "LIBRARY",
    "MISSION",
    "NATURAL",
    "ORGANIC",
    "PASSION",
    "QUALITY",
    "RESPECT",
    "STATION",
    "TEACHER",
    "UNIFIED",
    "VICTORY",
    "WARRIOR",
    "YELLOWY",
    "ZEALOUS",
    "JOURNEY",
    "FORTUNE",
    "VENTURE",
    "PROBLEM",
    "FREEDOM"
  ];
  
  var word = words[Math.floor(Math.random() * words.length)];

  
//put the array of words here; try 7x7?
window.onload = function(){
    initialize();
}


function initialize(){
    //create the game board
    for (let r = 0; r<height; r++){ //create each tile object
        for(let c=0; c<width; c++){
            let tile = document.createElement("span"); //put tiles next to each other
            tile.id=r.toString() + "-"+c.toString(); //make coordinates the name
            tile.classList.add("tile"); //using CSS tile style
            tile.innerText="";
            document.getElementById("board").appendChild(tile); //this will place the eventual tile object into the board section inthe html file
            
        }
    }
    //listen for key press

    document.addEventListener("keyup",(e) =>{
        if(gameOver) return;

        if("KeyA"<=e.code && e.code <="KeyZ"){
            if(col<width){
                let currTile = document.getElementById(row.toString()+'-'+col.toString())
                if(currTile.innerText==""){
                    currTile.innerText=e.code[3];
                    col+=1;
                }
            }

        }

        else if(e.code=="Backspace"){
            if(0<col&&col<=width){
                col-=1;
            }
            let currTile = document.getElementById(row.toString()+'-'+col.toString())
            currTile.innerText=""
        }

        else if(e.code=="Enter"){
            update()
            row+=1;
            col=0;
        }

        if(!gameOver&&row==height){
            gameOver=true;
            document.getElementById("answer").innerText=word;
        }


    }) //this way you cannot hold down key by accident

}

function update(){
    let correct=0;
    for(let c=0; c<width; c++){
        let currTile = document.getElementById(row.toString()+'-'+c.toString())
        let letter = currTile.innerText;

        if(word[c]==letter){
            currTile.classList.add("correct");
            correct+=1;
        }

        else if(word.includes(letter)){
            currTile.classList.add("present");
        }
        else{
            currTile.classList.add("absent");
        }

        if(correct==width){
            gameOver=true;
        }
    }
}
