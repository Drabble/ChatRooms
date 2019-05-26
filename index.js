var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 4200;
var Chance = require('chance');
var chance = new Chance();
var uuid = require('uuid');

// Serve public files
app.use(express.static('public'));
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

function requireHTTPS(req, res, next) {
	// The 'x-forwarded-proto' check is for Heroku
	if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.NODE_ENV !== "development") {
		return res.redirect('https://' + req.get('host') + req.url);
	}
	next();
}
app.use(requireHTTPS);

// On socket connection
io.on('connection', function (socket) {

	// Leave the default room
	socket.leaveAll();
	socket.join("afk");

	// Set random username
	socket.username = chance.prefix() + " " + chance.animal();
	socket.emit('username', socket.username);

	// Send list of rooms
	var rooms = Object.entries(io.of('/').adapter.rooms);
	var rooms_list = [];
	for (var i in rooms) {
		rooms_list.push({ 'name': rooms[i][0], 'count': rooms[i][1].length });
	}
	socket.emit('rooms', rooms_list);

	// Receive a new room request
	socket.on('room', function (msg) {
		socket.broadcast.to(socket.current_room).emit('client-leave', { 'id': socket.id, 'username': socket.username });
		socket.leaveAll();
		socket.current_room = msg;
		console.log("joined room " + msg);
		socket.join(msg);
		//if (io.of('/').adapter.rooms[msg] == null) {
		var rooms = Object.entries(io.of('/').adapter.rooms);
		var rooms_list = [];
		for (var i in rooms) {
			rooms_list.push({ 'name': rooms[i][0], 'count': rooms[i][1].length });
		}
		io.of('/').emit('rooms', rooms_list);

		io.of('/').in(msg).clients((err, data) => {
			var clients = [];
			for (var i in data) {
				clients.push({ 'id': io.of('/').connected[data[i]].id, 'username': io.of('/').connected[data[i]].username });
			}
			socket.emit('room', { "name": msg, "clients": clients });
			socket.broadcast.to(msg).emit('client-join', { 'id': socket.id, 'username': socket.username });
		});
	});

	// User disconnection
	socket.on('disconnect', () => {
		socket.broadcast.to(socket.current_room).emit('client-leave', { 'id': socket.id, 'username': socket.username });
		socket.leaveAll();
		var rooms = Object.entries(io.of('/').adapter.rooms);
		var rooms_list = [];
		for (var i in rooms) {
			rooms_list.push({ 'name': rooms[i][0], 'count': rooms[i][1].length });
		}
		io.emit('rooms', rooms_list);
	});
});

// Start listening for connections
http.listen(port, function () {
	console.log('listening on *:' + port);
});