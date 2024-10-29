//INITIALIZATION
//--------------------------------------------------
const express = require("express");
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

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
        '/test',
        '/docs'
    ]
}

var playerInfo = {
  frames: [ null, null ],
  types: [ null, null ]
}

var playerControlInfo = {}
var playerStreamInfo = {}

function loadOfflineImage(file) {

  const bitmap = fs.readFileSync(file)

  return Buffer.from( bitmap ).toString('base64')
}

playerInfo.frames[0] = loadOfflineImage('public/assets/Offline.jpg')

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
        stream: playerInfo
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
  console.log('Client connected');
  socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    delete SOCKET_LIST[socket.id];
  });

  socket.on('sendMsgToServer',function(data){
		var playerName = ("" + socket.id).slice(2,7);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',[post_id, playerName + ': ' + data]);
		}
    post_id += 1;
	});

  socket.on('deleteMsg',function(data){
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('removeFromChat', data);
		}
	});

  socket.on('evalServer',function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);		
	});
});