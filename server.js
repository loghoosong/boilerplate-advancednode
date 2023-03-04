'use strict';
require('dotenv').config();
const express = require('express');
const myDB = require('./connection');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const routes = require('./routes.js');
const auth = require('./auth.js');
const passportSocketIo = require('passport.socketio');
const MongoStore = require('connect-mongo')(session);

const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'pug');
app.set('views', './views/pug');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  store: store,
  key: 'express.sid',
  cookie: { secure: false },
}));

let currentUsers = 0;
myDB(async (client) => {
  const myDataBase = await client.db('database').collection('users');

  routes(app, myDataBase);
  auth(app, myDataBase);

  io.on('connection', socket => {
    console.log('A user has connected');
    console.log('user ' + socket.request.user.username + ' connnected');
    currentUsers++;
    io.emit('user', {
      username: socket.request.user.username,
      currentUsers,
      connected: true,
    });

    socket.on('disconnect', () => {
      console.log('A user has disconnected');
      currentUsers--;
      socket.emit('user count', {
        username: socket.request.user.username,
        currentUsers,
        connected: false,
      });
    });

    socket.on('chat message', message => {
      io.emit('chat message', {
        username: socket.request.user.username,
        message,
      });
    });
  });

  io.use(passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: 'express.sid',
    secret: process.env.GITHUB_CLIENT_SECRET,
    store: store,
    success: onAuthorizeSucess,
    fail: onAuthorizeFail,
  }));

  function onAuthorizeSucess(data, accept) {
    console.log('successful connection to soket.io');
    accept(null, data);
  }
  function onAuthorizeFail(data, message, error, accept) {
    if (error) throw new Error(message);
    console.log('failed connection to socket.io', message);
    accept(null, false);
  }
}).catch(err => {
  app.route('/').get((req, res) => {
    res.render('index', {
      title: 'e',
      message: 'Unable to connect to database'
    });
  })
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});

