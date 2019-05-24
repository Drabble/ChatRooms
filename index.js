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

// On socket connection
io.on('connection', function (socket) {

	// Leave the default room
	socket.leaveAll();

	// Set random username
	socket.username = chance.prefix() + " " + chance.profession() + " " + chance.animal();
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
		socket.leave(socket.current_room);
		socket.current_room = msg;
		console.log("joined room " + msg);
		socket.join(msg);
		//if (io.of('/').adapter.rooms[msg] == null) {
		var rooms = Object.entries(io.of('/').adapter.rooms);
		var rooms_list = [];
		for (var i in rooms) {
			rooms_list.push({ 'name': rooms[i][0], 'count': rooms[i][1].length });
		}
		io.emit('rooms', rooms_list);

		io.of('/').in(msg).clients((err, data) => {
			var clients = [];
			for (var i in data) {
				clients.push({ 'id': io.of('/').connected[data[i]].id, 'username': io.of('/').connected[data[i]].username })
			}
			socket.emit('room', { "name": msg, "clients": clients });
			socket.broadcast.to(msg).emit('clients', clients);
		});
	});

	// User disconnection
	socket.on('disconnect', () => {
		io.of('/').in(socket.current_room).clients((err, data) => {
			var clients = [];
			for (var i in data) {
				clients.push({ 'id': io.of('/').connected[data[i]].id, 'username': io.of('/').connected[data[i]].username })
			}
			io.of("/").to(socket.current_room).emit('clients', clients);
		});
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