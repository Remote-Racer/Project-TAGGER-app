//Internal storage for lobbies
var gamesList = {};

//Constructor for lobby objects
function newGame(data){
    gameID = Math.ceil(Math.random() * 1000000);
    gamesList[gameID] = {
        playerList: {},
        admins: {},
        score: [0, 0],
        round: 1,
        roundCount: data[1],
        id: gameID,
        runner: false,
        timer: null,
        startTime: 0,
        pauseTime: data[0],
        paused: false,
        roundLength: data[0]
    }
    return gameID;
}

//Destructor for game objects
//Takes input of lobby index value
//Returns integer value denoting winning player
function endGame(gameID){
    var winner = -1;
    if(gamesList[gameID].score[0] > gamesList[gameID].score[1]){
        winner = 1;
    } else {
        winner = 2;
    }
    delete gamesList[gameID];
    return winner;
}

//Function for ending current round
//Takes inputs of lobby index and boolean value denoting player (true = 1, false = 2)
//Returns boolean value indicating if game has concluded
function endRound(gameID, player){
    if(player){
        gamesList[gameID].score[0] += 1;
    } else {
        gamesList[gameID].score[1] += 1;
    }
    gamesList[gameID].round += 1;
    gamesList[gameID].runner = !gamesList[gameID].runner;
    gamesList[gameID].pauseTime = gamesList[gameID].roundLength;

    if(gamesList[gameID].round > gamesList[gameID].roundCount || gamesList[gameID].score[0] == Math.ceil(gamesList[gameID].roundCount/2) || gamesList[gameID].score[1] == Math.ceil(gamesList[gameID].roundCount/2)){
        return true;
    }
    return false;
}

//Function for entering players into a lobby with checks for invalid actions
//Takes input of array with lobby index value at 0 and player index value at 1
//Returns a boolean value indicating if player could join current lobby
function joinGame(data){
    console.log('Player joining lobby ' + data[0] + ', current playercount: ' + Object.keys(gamesList[data[0]].playerList).length);
    if(Object.keys(gamesList[data[0]].playerList).length < 2){
        gamesList[data[0]].playerList[data[1]] = data[1];
        return 1;
    } else {
        return 0;
    }
}

function joinAdmin(data){
    console.log('Admin joining lobby ' + data[0]);
    gamesList[data[0]].admins[data[1]] = data[1];
}

function leaveAdmin(data){
    delete gamesList[data[0]].admins[data[1]];
}

function handleDisconnect(lobby, player){
    pauseGame(lobby);
    delete lobby.playerList[player];
}

function pauseGame(lobby){
    lobby.pauseTime -= (Date.now()- lobby.startTime)/1000;
    console.log('paused at ' + lobby.pauseTime + ' seconds left');
    clearTimeout(lobby.timer);
    lobby.paused = true;
}

//Exported values for reference in app.js
module.exports = {gamesList, newGame, endGame, endRound, joinGame, joinAdmin, leaveAdmin, handleDisconnect, pauseGame};