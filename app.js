// Server for frontend development
console.log('app');
var express = require('express'),
  fs = require('fs'),
  app = express(),
  bodyParser = require('body-parser'),
  engine = require('ejs-locals'),
  port = 3000;

// Express settings
app.set('port', port);
app.set('views', __dirname + '/views');
app.engine('ejs', engine); // use ejs as view engine
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

// Static files
app.use(express.static(__dirname + '/public'));

// Register index route.
app.get('/', function (req, res) {
  res.render('index');
});

// Register simple file structure route.
app.get('/*.ejs', function (req, res) {
  res.render(req.params[0]);
});


// Listen to port.
app.listen(app.get('port'));
console.log('Frontend server running on: ' + 'http://localhost:' + port.toString());
