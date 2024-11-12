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

var hash = require('pbkdf2-password')()
var path = require('path');
var session = require('express-session');
const { equal } = require("assert");
const e = require("express");

app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

//AUTHENTICATION
//--------------------------------------------------
//User list
var users = {
  p1: { name: 'p1' },
  p2: { name: 'p2' },
  p3: { name: 'p3' },
};

//Salting and hashing for user passwords
hash({ password: 'pass1' }, function (err, pass, salt, hash) {
  if (err) throw err;
  users.p1.salt = salt;
  users.p1.hash = hash;
});
hash({ password: 'pass2' }, function (err, pass, salt, hash) {
  if (err) throw err;
  users.p2.salt = salt;
  users.p2.hash = hash;
});
hash({ password: 'pass3' }, function (err, pass, salt, hash) {
  if (err) throw err;
  users.p3.salt = salt;
  users.p3.hash = hash;
});

//User Authentication
function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(null, null)
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
    if (err) return fn(err);
    if (hash === user.hash) return fn(null, user)
    fn(null, null)
  });
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
}

//Routes
app.get('/', function(req, res){
    res.render('Home', {
        name: req.session.user,
        page: {
            title: 'Home'
        },
        global: globalInfo
    });
});

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/admin', function(req, res){
  res.render('Admin', {
    name: req.session.user,
    page: {
        title: 'Admin'
    },
    global: globalInfo,
    stream: playerStreamInfo[ req.session.user.name ]
  })
})

app.get('/spectator', function(req, res){
    res.render('Spectator', {
        name: req.session.user,
        page: {
            title: 'Spectator'
        },
        global: globalInfo
    });
});

app.get('/test', function(req, res){
    res.render('TestView', {
        name: req.session.user,
        page: {
            title: 'Test Page'
        },
        global: globalInfo
    });
});

app.get('/docs', function(req, res){
  res.render('Documentation', {
      name: req.session.user,
      page: {
          title: 'Documentation'
      },
      global: globalInfo
  });
});

app.get('/player', function(req, res){
    res.render('Player', {
        name: req.session.user,
        page: {
            title: 'Player'
        },
        global: globalInfo,
        stream: playerStreamInfo[ req.session.user.name ]
    });
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

  if( req.session.user ) {

    res.status(200).send( playerStreamInfo[ req.session.user.name ] )
    return
  }

  res.status(400).send({ error: 'No session for streaming! Please login!' })
});

app.get('/player/:id/stream', (req, res) => {

  res.status(200).send( playerStreamInfo[ req.params.id ] )
});

app.post('/login', function (req, res, next) {
    if (!req.body) return res.sendStatus(400)
    authenticate(req.body.username, req.body.password, function(err, user){
      if (err) return next(err)
      if (user) {
        // Regenerate session when signing in
        // to prevent fixation
        req.session.regenerate(function(){
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name
        + ' click to <a href="/logout">logout</a>. '
        + ' You may now access <a href="/restricted">/restricted</a>.';
        //Redirect to page user signed in on
        res.redirect(req.headers.referer.substring(req.headers.referer.lastIndexOf('/')));
    });
        } else {
            req.session.error = 'Authentication failed, please check your '
            + ' username and password.'
            + ' (use "tj" and "foobar")';
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

  if( req.session.user && req.session.user.name ) {

    playerControlInfo[ req.session.user.name ] = req.body['axes'] 

    return res.status(200).send({})
  }

  res.status(400).send({ error: 'Missing credentials for control upload' })
});

//STARTUP
//--------------------------------------------------

server.listen(process.env.PORT || 3000, () => {
  console.log('Server listening on port 3000');
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
      for(var i in gameServer.gamesList[socket.lobby].playerList){
        SOCKET_LIST[i].emit('pause');
      }
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
        for(var i in gameServer.gamesList[data].playerList){
          SOCKET_LIST[i].emit('updateRound', [gameServer.gamesList[data].round, gameServer.gamesList[data].pauseTime]);
          SOCKET_LIST[i].emit('updateScore', gameServer.gamesList[data].score);
          SOCKET_LIST[i].emit('enableCam');
        }
        for(var j in gameServer.gamesList[data].admins){
          SOCKET_LIST[j].emit('updateRound', gameServer.gamesList[data].round);
          SOCKET_LIST[j].emit('updateScore', gameServer.gamesList[data].score);
        }
        if(gameServer.gamesList[data].paused){
          gameServer.gamesList[data].paused = false;
        } else {
          gameServer.gamesList[data].pauseTime = gameServer.gamesList[data].roundLength;
        }
        gameServer.gamesList[data].startTime = Date.now();
        gameServer.gamesList[data].timer = setTimeout(function(){winRound(data, gameServer.gamesList[data].runner)}, gameServer.gamesList[data].pauseTime * 1000);
      }
      for(var i in gameServer.gamesList[data].playerList){
        if(i == socket.id){
          for(var j in gameServer.gamesList[data].playerList){
            SOCKET_LIST[j].emit('addPlayer', socket.id);
          }
        } else {
          socket.emit('addPlayer', i);
        }
      }
      for(var j in gameServer.gamesList[data].admins){
        SOCKET_LIST[j].emit('addPlayer', socket.id);
      }
    } else {
      socket.emit('joinResponse', [2, -1]);
    }
  })

  socket.on('joinAdmin', function(data){
    if(socket.lobby != 0){
      socket.emit('joinResponse', [0, -1]);
    } else {
      socket.lobby = data;
      socket.emit('joinResponse', [1, socket.lobby]);
      gameServer.joinAdmin([data, socket.id])
      for(var i in gameServer.gamesList[data].playerList){
        socket.emit('addPlayer', i);
      }
      socket.emit('updateRound', [gameServer.gamesList[data].round, gameServer.gamesList[data].roundLength]);
      socket.emit('updateScore', gameServer.gamesList[data].score);
    }
  })

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
      for(var i in players){
        SOCKET_LIST[i].emit('updateScore', endScore);
        SOCKET_LIST[i].emit('gameOver', [game, gameWinner]);
        SOCKET_LIST[i].lobby = 0;
      }
      for(var k in admins){
        SOCKET_LIST[k].emit('updateScore', endScore);
        SOCKET_LIST[k].emit('gameOver', [game, gameWinner]);
        SOCKET_LIST[k].lobby = 0;
      }
      for(var j in SOCKET_LIST){
        SOCKET_LIST[j].emit('removeGame', game);
      }
    } else {
      for(var i in gameServer.gamesList[game].playerList){
        SOCKET_LIST[i].emit('updateRound', [gameServer.gamesList[game].round, gameServer.gamesList[game].roundLength]);
        SOCKET_LIST[i].emit('updateScore', gameServer.gamesList[game].score);
      }
      for(var j in gameServer.gamesList[game].admins){
        SOCKET_LIST[j].emit('updateRound', gameServer.gamesList[game].round);
        SOCKET_LIST[j].emit('updateScore', gameServer.gamesList[game].score);
      }
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

  socket.on('pauseGame', () => {
    if(socket.lobby != 0){
      gameServer.pauseGame(gameServer.gamesList[socket.lobby]);
      for(var i in gameServer.gamesList[socket.lobby].playerList){
        SOCKET_LIST[i].emit('pause');
      }
    }
  });

});