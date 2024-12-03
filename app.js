//INITIALIZATION
//--------------------------------------------------
require('dotenv').config();
const express = require("express");
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const gameServer = require('./game.js');

const fs = require('fs')

const fileUpload = require('express-fileupload')

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(fileUpload())

var path = require('path');
const { equal } = require("assert");
const e = require("express");

var cookieParser = require('cookie-parser');
app.use(cookieParser());

//AUTHENTICATION
//--------------------------------------------------
//User list
var users = {
  p1: {password: 'pass1', isAdmin: false, loggedIn: false},
  p2: {password: 'pass2', isAdmin: false, loggedIn: false},
  p3: {password: 'pass3', isAdmin: true, loggedIn: false},
};

//User Authentication
function authenticate(name, pass, fn) {
  console.log('authenticating %s:%s', name, pass);
  if(users[name]){
    if(users[name].password == pass && !users[name].loggedIn){
      users[name].loggedIn = true;
      fn(name);
    } else {
      fn(null);
    }
  } else {
    fn(null);
  }
}

function restrictPage(user, admin, fn){
  if(user){
    if((user && !admin) || (users[user].isAdmin && admin)){
      fn(true);
    } else {
      fn(false);
    }
  } else {
    fn(false);
  }
}

//ROUTING
//--------------------------------------------------
//Data
const globalInfo = {
    navEndpoints: [
        '/',
        '/spectator',
        '/player',
        '/admin',
        '/test',
        '/docs'
    ]
}

var playerControlInfo = {}
var playerStreamInfo = {}

function loadOfflineImage(file) {

  const bitmap = fs.readFileSync(file)

  return Buffer.from( bitmap ).toString('base64')
}

const offlineImage = loadOfflineImage('public/assets/Offline.jpg')

for( let user in users ) {

  playerStreamInfo[ user ] = {
    frame: offlineImage,
    type: 'image/jpeg' 
  }

  playerControlInfo[ user ] = [0, 0];
}

//Routes
app.get('/', function(req, res){
    //console.log(req.cookies.name);
    res.render('Home', {
        name: req.cookies.name,
        page: {
            title: 'Home'
        },
        global: globalInfo
    });
});

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  if(req.cookies.name){
    users[req.cookies.name].loggedIn = false;
  }
  res.clearCookie('name');
  res.redirect('/');
});

app.get('/admin', function(req, res){
  restrictPage(req.cookies.name, true, function(allowed){
    if(allowed){
      res.render('Admin', {
        name: req.cookies.name,
        page: {
            title: 'Admin'
        },
        global: globalInfo,
        stream: playerStreamInfo[ req.cookies.name ]
      })
    } else {
      console.log('Redirected: need to be admin')
      res.redirect('/')
    }
  })
})

app.get('/spectator', function(req, res){
    res.render('Spectator', {
        name: req.cookies.name,
        isAdmin: req.cookies.name ? users[req.cookies.name].isAdmin : false,
        page: {
            title: 'Spectator'
        },
        global: globalInfo
    });
});

app.get('/test', function(req, res){
    res.render('TestView', {
        name: req.cookies.name,
        page: {
            title: 'Test Page'
        },
        global: globalInfo
    });
});

app.get('/docs', function(req, res){
  res.render('Documentation', {
      name: req.cookies.name,
      page: {
          title: 'Documentation'
      },
      global: globalInfo
  });
});

app.get('/player', function(req, res){
  restrictPage(req.cookies.name, false, function(allowed){
    if(allowed){
      res.render('Player', {
        name: req.cookies.name,
        page: {
            title: 'Player'
        },
        global: globalInfo,
        stream: playerStreamInfo[ req.cookies.name ]
      });
    } else {
      console.log('Redirected: need to be logged in')
      res.status(401).redirect('/');
    }
  })
});

app.get('/player/:id/control', (req, res) => {

  let playerControllerState = playerControlInfo[ req.params.id ]

  if( playerControllerState ) {

    res.send({
      x: playerControllerState[0],
      y: playerControllerState[1]
    })

    res.status(200).send({})
    return
  }

  res.status(400).send({ error: 'Invalid player id!' })
})

app.get('/player/stream', (req, res) => {

  if( req.cookie.name ) {

    res.status(200).send( playerStreamInfo[ req.cookie.name ] )
    return
  }

  res.status(400).send({ error: 'No session for streaming! Please login!' })
});

app.get('/player/:id/stream', (req, res) => {

  res.status(200).send( playerStreamInfo[ req.params.id ] )
});

app.post('/login', function (req, res, next) {
    if (!req.body) return res.sendStatus(400)
    authenticate(req.body.username, req.body.password, function(user){
      if (user) {
          res.cookie('name', req.body.username, {maxAge: 360000});
          res.redirect(req.headers.referer.substring(req.headers.referer.lastIndexOf('/')));
      } else {
          //req.session.error = 'Authentication failed, please check your '
          //+ ' username and password.';
          res.redirect('/');
      }
    });
});

app.post('/upload/:id/stream', (req, res) => {

  const { data, mimetype } = req.files.frame

  const encode = (data) => {
    let buf = Buffer.from(data)
    let base64 = buf.toString('base64')
    return base64
  }

  if( playerStreamInfo[ req.params.id ] ) {

    playerStreamInfo[ req.params.id ] = {
      frame: encode( data ),
      type: mimetype
    }

    res.status(200).send({})
    return;
  }

  res.status(400).send({ error: 'Missing id for stream upload' })
});

app.post('/upload/player/control', (req, res) => {

  if( req.cookies.name ) {

    playerControlInfo[ req.cookies.name ] = req.body['axes'] 

    return res.status(200).send({})
  }

  res.status(400).send({ error: 'Missing credentials for control upload' })
});

//STARTUP
//--------------------------------------------------

server.listen(process.env.PORT || 3000, () => {
  console.log('Server listening on port ' + process.env.PORT);
});

//SOCKETS
//--------------------------------------------------
var SOCKET_LIST = {};
var post_id = 0;

io.on('connection', (socket) => {
  //General
  //Adds connected client to list with a unique identifier, sets default lobby value
  console.log('Client connected');
  socket.id = Math.ceil(Math.random() * 1000000);
	SOCKET_LIST[socket.id] = socket;
  socket.lobby = 0;

  //Disconnects client and clears the socket identifier from the list
  socket.on('disconnect', () => {
    if(socket.lobby != 0){
      gameServer.handleDisconnect(gameServer.gamesList[socket.lobby], socket.id);
      pushToLobby(socket.lobby,  'pause');
      pushToLobby(socket.lobby, 'removePlayer', socket.id);
    }
    console.log('Client disconnected');
    delete SOCKET_LIST[socket.id];
  });

  //Chat System
  //Collects message from client and relays it to all connected clients
  socket.on('sendMsgToServer',function(data){
		var playerName = ("" + socket.id).slice(2,7);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',[post_id, playerName + ': ' + data]);
		}
    post_id += 1;
	});

  //Game System
  //Populates all clients with current server list
  for(var i in gameServer.gamesList){
    socket.emit('updateGames', i);
  }
  socket.emit('gamesCount', Object.keys(gameServer.gamesList).length);

  //Checks if player at current socket can join and responds with a flag indicating output status
  //If first player joins, sends message to present queue message
  //If second player joins, initiates round timer and pushes initial game state for display
  socket.on('joinLobby', function(data){
    if(socket.lobby != 0){
      socket.emit('joinResponse', [0, -1]);
    } else if(gameServer.joinGame([data, socket.id]) == 1){
      socket.lobby = data;
      socket.emit('joinResponse', [1, socket.lobby]);
      if(Object.keys(gameServer.gamesList[data].playerList).length == 1){
        socket.emit('updateQueue');
      }
      if(Object.keys(gameServer.gamesList[data].playerList).length == 2){
        pushToLobby(data, 'updateRound', [gameServer.gamesList[data].round, gameServer.gamesList[data].pauseTime])
        pushToLobby(data, 'updateScore', gameServer.gamesList[data].score)
        pushToLobby(data, 'enableCam')

        if(gameServer.gamesList[data].paused){
          gameServer.gamesList[data].paused = false;
        } else {
          gameServer.gamesList[data].pauseTime = gameServer.gamesList[data].roundLength;
        }
        gameServer.gamesList[data].startTime = Date.now();
        gameServer.gamesList[data].timer = setTimeout(function(){winRound(data, gameServer.gamesList[data].runner)}, gameServer.gamesList[data].pauseTime * 1000);
      }

      pushToLobby(data, 'addPlayer', socket.id);
    } else {
      socket.emit('joinResponse', [2, -1]);
    }
  })

  //Checks if admin can enter a lobby and sends a corresponding flag
  //Admins are added to a separate list from the players
  //If round is active, sends updates for round and score
  socket.on('joinAdmin', function(data){
    if(socket.lobby != 0){
      socket.emit('joinResponse', [0, -1]);
    } else {
      socket.lobby = data;
      socket.emit('joinResponse', [1, socket.lobby]);
      gameServer.joinAdmin([data, socket.id])
      if(Object.keys(gameServer.gamesList[data].playerList).length == 2){
        socket.emit('updateRound', [gameServer.gamesList[data].round, gameServer.gamesList[data].roundLength]);
        socket.emit('updateScore', gameServer.gamesList[data].score);
        socket.emit('enableAdmin');
      }
    }
  })

  //Handles exiting lobbies for admins
  //If lobby is not default value, calls corresponding handler and resets socket lobby value
  socket.on('leaveAdmin', () => {
    if(socket.lobby != 0){
      gameServer.leaveAdmin([socket.lobby, socket.id]);
      socket.lobby = 0;
    }
  })

  //Admin Functionality
  //Collects specified index and sends request to delete message to all clients
  socket.on('deleteMsg',function(data){
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('removeFromChat', data);
		}
	});

  //Creates a new lobby pushes new index to all clients for display
  socket.on('createLobby', function(data){
    var newLobby = gameServer.newGame(data);
    for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit('updateGames', newLobby);
      SOCKET_LIST[i].emit('gamesCount', Object.keys(gameServer.gamesList).length);
    }
  });

  //Processes request to end round, if game is over, sends final messages to players
  //in the lobby, destroys lobby, and pushes message to delete its listing on all clients
  //If game is still running, update scores and initiate a new round timer with roles reversed
  function winRound(game, player){
    if(gameServer.endRound(game, player)){
      var endScore = gameServer.gamesList[game].score
      var players = gameServer.gamesList[game].playerList
      var admins = gameServer.gamesList[game].admins
      var gameWinner = gameServer.endGame(game)

      pushToLobby(game, 'updateScore', endScore)
      pushToLobby(game, 'gameOver', [game, gameWinner])
      updateLobby(game)

      for(var j in SOCKET_LIST){
        SOCKET_LIST[j].emit('removeGame', game);
      }
    } else {
      pushToLobby(game, 'updateRound', [gameServer.gamesList[game].round, gameServer.gamesList[game].roundLength]);
      pushToLobby(game, 'updateScore', gameServer.gamesList[game].score);

      gameServer.gamesList[game].timer = setTimeout(function(){winRound(game, gameServer.gamesList[game].runner)}, gameServer.gamesList[game].roundLength * 1000);
    }
  }

  //Processes requests to end round premaurely
  //Interrupts round timer and initiates round end function with given parameters
  socket.on('winRound', function(data){
    if(data[0] != -1 && gameServer.gamesList[data[0]].timer){
      clearTimeout(gameServer.gamesList[data[0]].timer);
      winRound(data[0], data[1])
    }
  });

  //Processes requests to pause round timer
  //Given a valid lobby with no pause flag, calls pause handler function and emits update for all clients
  socket.on('pauseGame', () => {
    if(socket.lobby != 0 && !gameServer.gamesList[socket.lobby].paused){
      gameServer.pauseGame(gameServer.gamesList[socket.lobby]);
      pushToLobby(socket.lobby, 'pause')
    }
  });

  //Processes requests to pause round timer
  //Given a valid lobby with pause flag, sets new timer and emits an update to all clients
  socket.on('unpauseGame', () => {
    if(socket.lobby != 0 && gameServer.gamesList[socket.lobby].paused){
      gameServer.gamesList[socket.lobby].startTime = Date.now();
      gameServer.gamesList[socket.lobby].timer = setTimeout(function(){winRound(socket.lobby, gameServer.gamesList[socket.lobby].runner)}, gameServer.gamesList[socket.lobby].pauseTime * 1000);
      gameServer.gamesList[socket.lobby].paused = false;

      pushToLobby(socket.lobby, 'updateRound', [gameServer.gamesList[socket.lobby].round, gameServer.gamesList[socket.lobby].pauseTime])
    }
  });

  //Processes requests to modify round timer
  //Given a valid lobby, starts a new round timer with given value, unpauses game, and updates clients
  socket.on('setTimer', function(data){
    if(socket.lobby != 0){
      console.log('setting timer to ' + data);
      clearTimeout(gameServer.gamesList[socket.lobby].timer);
      gameServer.gamesList[socket.lobby].pauseTime = data;
      gameServer.gamesList[socket.lobby].startTime = Date.now();
      gameServer.gamesList[socket.lobby].timer = setTimeout(function(){winRound(socket.lobby, gameServer.gamesList[socket.lobby].runner)}, data * 1000);
      gameServer.gamesList[socket.lobby].paused = false;

      pushToLobby(socket.lobby, 'updateRound', [gameServer.gamesList[socket.lobby].round, data])
    }
  });

  function pushToLobby(lobby, command, params){
    for(var i in gameServer.gamesList[lobby].playerList){
      SOCKET_LIST[i].emit(command, params);
    }
    for(var j in gameServer.gamesList[lobby].admins){
      SOCKET_LIST[j].emit(command, params);
    }
  }

  function updateLobby(lobby){
    for(var i in gameServer.gamesList[lobby].playerList){
      SOCKET_LIST[i].lobby = 0;
    }
    for(var j in gameServer.gamesList[lobby].admins){
      SOCKET_LIST[i].lobby = 0;
    }
  }
});