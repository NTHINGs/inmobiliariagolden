#!/usr/bin/env node
var express  = require('express');
var redirect = require("express-redirect");
var session  = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var favicon = require('serve-favicon');
var MemoryStore = require('session-memory-store')(session);
require('dotenv').config();

var app      = express();
var port     = process.env.PORT || 8080;

var passport = require('passport');
var flash    = require('connect-flash');

//database
var mysql = require('mysql');
var dbconfig = require('./config/database');
var connection = mysql.createConnection(dbconfig.connection, {multipleStatements: true});
connection.query('USE ' + dbconfig.database);

var app = express();
app.use(favicon(__dirname + '/assets/casita.ico'));
redirect(app);
require('./config/passport')(passport);
// set up our express application
app.use(morgan('common')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(express.static('assets'));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    store: new MemoryStore(),
 } )); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session


// routes ======================================================================
require('./app/routes.js')(app, passport,connection); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);