//Variables and page element references
var gameList = document.getElementById('game-list');
//var lobbyName = document.getElementById('lobby-name');
var playerList = document.getElementById('player-list');
var roundCount = document.getElementById('round-count');
var lobby = -1;
var timer = null;

//Removes lobby at specified index
socket.on('removeGame', function(data){
  document.getElementById(data).remove();
});

//Updates round counter with current value
socket.on('updateRound', function(data){
  roundCount.innerHTML = 'Round ' + data[0];
  setTimer(data[1]);
});

//Updates score readout with current value
socket.on('updateScore', function(data){
  document.getElementById('p1-score').innerHTML = data[0];
  document.getElementById('p2-score').innerHTML = data[1];
  //scoreCount.innerHTML = 'Score: ' + data[0] + ':' + data[1];
});

//Replaces round counter with waiting message until second player connects
socket.on('updateQueue', () => {
  roundCount.innerHTML = 'Starting Soon...';
})

//Displays win message, clears other text fields, and resets flag for joining new lobbies
socket.on('gameOver', function(data){
  if(lobby == data[0]){
    document.getElementById('lobby-menu').style.display = 'initial';
    document.getElementById('game-menu').style.display = 'none';
    lobby = -1;
    roundCount.innerHTML = "Game Over, player " + data[1] + " wins!";
    document.getElementById('stream-container').style.display = 'none';
  }
  //lobbyName.innerHTML = 'Currently Browsing Lobbies';
  //scoreCount.innerHTML = 'Score: N/A';
  playerList.innerHTML = '';
})

//Presents an alert depending on flag passed by server
//0 = fail due to existing connection
//1 = success
//2 = fail due to full lobby
//default catches unexpected errors
socket.on('joinResponse', function(data){
  console.log(data);
  switch(data[0]){
      case 0:
          alert('Currently in a lobby.');
          break;
      case 1:
          alert('Joined Lobby!');
          //lobbyName.innerHTML = 'Now in lobby ' + data[1] + '.';
          document.getElementById('lobby-menu').style.display = 'none';
          document.getElementById('game-menu').style.display = 'initial';
          lobby = data[1];
          break;
      case 2:
          alert('Lobby is currently full.');
          break; 
      default:
          console.log('Something went wrong.');
          break;
  }
});

//Adds the given player index to the player list
socket.on('addPlayer', function(data){
  console.log(data + ' joined the game.');
  playerList.innerHTML += '<li>' + data + '</li>';
});

socket.on('gamesCount', function(data){
  document.getElementById('lobby-status').innerHTML = data + ' Active Lobbies Found!'
});

socket.on('enableCam', () => {
  document.getElementById('stream-container').style.display = 'initial';
});

socket.on('pause', () => {
  clearInterval(timer);
  document.getElementById('round-timer').innerHTML = 'PAUSE';
});

function setTimer(time){
  if(timer != null){
    clearInterval(timer);
  }
  var timeLeft = Math.floor(time);
  timer = setInterval(function(){
    document.getElementById('round-timer').innerHTML = timeLeft;
    if(timeLeft <= 0){
      clearInterval(timer);
    }
    timeLeft -= 1;
  }, 1000);
}