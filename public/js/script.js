$(function () {
    var socket = io();
    var myStream;
    var peer;
    var username;
    var clients = [];
    var current_room;

    var f = function() {
        for (var i in clients) {
            if(clients[i].conn != null){
                clients[i].conn.send({action: 'ping', time: Date.now()});
            }
        }
    };
    window.setInterval(f, 10000);

    /*********** Get mic stream *******************/
    // handle browser prefixes
    navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.mediaDevices.getUserMedia);

    // Get access to microphone
    navigator.getUserMedia(
        // Only request audio
        { video: false, audio: true },

        // Success callback
        function success(localAudioStream) {
            info('Microphone is open.');
            myStream = localAudioStream;
        },
        // Failure callback
        function error(err) {
            info('Couldn\'t connect to microphone. Reload the page to try again.');
        }
    );

    /********** Button clicks ******************/
    // Send message
    $('#send').submit(function () {
        if($("#m").val() !== ""){
            for (var i in clients) {
                if(clients[i].conn != null){
                    clients[i].conn.send($("#m").val());
                }
            }
            window.scrollTo(0, document.body.scrollHeight);
            
            $('#messages').append(`<li><span class="message-username" style="color: red">${username} : </span>${$('#m').val()}</li>`);
            $('#m').val('');
        }
        return false;
    });

    // Create new room
    $("#new_room").on('submit', function () {
        socket.emit('room', $("#room-name").val());
        current_room = $("#room-name").val();
        $("#messages").empty();
        $('#room-name').val('');
        return false;
    });

    // Join existing room
    $(document).on('click', '.room', function () {
        $("#messages").empty();
        socket.emit('room', $(this).text());
        current_room = $(this).text();
        return false;
    });

    // Leave room
    $("#leave-room").on('click', function () {
        $("#messages").empty();
        $("#users table").empty();
        $("#users table").append('<tr><td colspan="2"><i>Not in room yet...</i></td></tr>');
        socket.emit('leave-room');
        current_room = null;
        $("#leave-room").hide();
        return false;
    });

    // Leave room
    $(document).on('click', '.mute', function () {
        $(this).parent().find(".unmute").css("display", "inline");
        $(this).css("display", "none");
        return false;
    });

    // Leave room
    $(document).on('click', '.unmute', function () {
        $(this).parent().find(".mute").css("display", "inline");
        $(this).css("display", "none");
        return false;
    });

    // Leave room
    $(document).on('click', '.sync', function () {
        
        return false;
    });

    /************ SocketIO callback *****************/
    // Connect to server
    socket.on('connect', () => {
        $("#loader-container").delay(1000).fadeOut(function () { $(this).remove() });
        $("#status-icon").css("color", "green");
        socket.emit("hello");
    });

    // Disconnect from server
    socket.on('disconnect', function () {
        $("#status-icon").css("color", "red");
    });

    // Reconnect to server
    socket.on('reconnect', function () {
        $("#status-icon").css("color", "green");
    });

    // Receive username
    socket.on("username", function (msg) {
        username = msg;
        $("#username").text(username);
    });

    // Get list of rooms
    socket.on("rooms", function (rooms) {
        console.log("List of rooms");
        console.log(rooms);

        $("#rooms table").empty();
        if (rooms.length == 0) {
            $("#rooms table").append(`<tr><td colspan="2"><i>No room yet...</i></td></tr>`);
        }
        rooms.sort(function(a, b){return b-a});
        for (var i in rooms) {
            if(rooms[i].name === current_room){
                $("#rooms table").append(`<tr><td><p class="active-room">${rooms[i].name}</p></td><td style="text-align: right;"><i class="fas fa-user"> ${rooms[i].count}</td></tr>`);
            } else{
                $("#rooms table").append(`<tr><td><a href="#" class="room">${rooms[i].name}</a></td><td style="text-align: right;"><i class="fas fa-user"> ${rooms[i].count}</td></tr>`);
            }
        }
    });

    // Receive list of clients
    socket.on("client-join", function(client){
        console.log(client);
        $("#users table").append(`<tr><td><p>${client.username}</p></td><td style="text-align: right;"><a href="#" class="fas fa-volume-mute mute" style="display: none;"></a> <a href="#" class="fas fa-volume-up unmute" style="display: none;"></a> <a href="#" class="fas fa-sync sync"></a> <i id="status-icon" class="fas fa-circle status" style="color: red;"></i> <span class="ping"></span></tr>`);
        clients.push(client);
    });

    
    socket.on("client-leave", function(client){
        for (var i in clients) {
            if(client.id == clients[i].id){
                break;
            }
        }
        clients.splice(i,1);
        var child = $("#users table").children().first().children().eq(i);
        if(child != null){
            child.remove();
        }
    });

    // Join room
    socket.on("room", function (msg) {
        // Close previous connections
        for (var i in clients) {
            if(clients[i].conn != null){
                clients[i].conn.close();
            }
        }
        clients = [];
        $("#users-table").empty();
        if (peer != null) {
            peer.destroy();
        }

        $("#leave-room").css("display", "block");

        // Handle incoming p2p conns
        peer = new Peer(socket.id);
        peer.on('connection', function (conn) {
            for(var i in clients){
                if(clients[i].id == conn.peer){
                    clients[i].conn = conn;
                    $("#users table").children().first().children().eq(i).find(".status").css("color", "green");
                    $("#users table").children().first().children().eq(i).find(".unmute").css("display", "inline");
                    break;
                }
            }

            conn.on('data', function (data) {
                if(data.action === "ping") {
                    data.action = "pong";
                    conn.send(data);
                    console.log("Ping received, pong sent.");
                } else if(data.action === "pong") {
                    var time = Date.now() - data.time;
                    console.log("Ping roundtrip: " + time + "ms");
                    $("#users table").children().first().children().eq(i).find(".ping").text(time + " ms");
                } else{
                    console.log(data);
                    $('#messages').append(`<li><span class="message-username">${clients[i].username} : </span>${data}</li>`);
                    window.scrollTo(0, document.body.scrollHeight);
                }
            });

            peer.on('call', function (call) {
                call.answer(myStream); // Answer the call with an A/V stream.
                call.on('stream', function (remoteStream) {
                    playStream(remoteStream);
                });
            });
        });
        peer.on('open', function (id) {
            info("Joined the room");
            for (var i in msg.clients) {
                if (msg.clients[i].id !== socket.id) {
                    clients[i].conn = peer.connect(msg.clients[i].id);

                    (function (i) {
                        // on open will be launch when you successfully connect to PeerServer
                        clients[i].conn.on('open', function () { 
                            $("#users table").children().first().children().eq(i).find(".status").css("color", "green");
                            $("#users table").children().first().children().eq(i).find(".unmute").css("display", "inline");
                            info("Connected to " + msg.clients[i].username);

                            var call = peer.call(msg.clients[i].id, myStream);
                            call.on('stream', function (remoteStream) {
                                //info("Sending stream to " + msg.clients[i].username);
                                playStream(remoteStream);
                            });
                            clients[i].conn.on('data', function (data) {
                                if(data.action === "ping") {
                                    data.action = "pong";
                                    clients[i].conn.send(data);
                                    console.log("Ping received, pong sent.");
                                } else if(data.action === "pong") {
                                    var time = Date.now() - data.time;
                                    console.log("Ping roundtrip: " + time + "ms");
                                    $("#users table").children().first().children().eq(i).find(".ping").text(time + " ms");
                                } else{
                                    console.log(data);
                                    $('#messages').append(`<li><span class="message-username">${clients[i].username} : </span>${data}</li>`);
                                    window.scrollTo(0, document.body.scrollHeight);
                                }
                            });
                        });
                    })(i);
                }
            }
        });

        // Update users table
        $("#users table").empty();
        clients = msg.clients;
        if (msg.clients.length == 0) {
            $("#users table").append(`<tr><td colspan="2"><i>Not in room yet...</i></td></tr>`);
        }
        for (var i in msg.clients) {
            if(msg.clients[i].username === username){
                $("#users table").append(`<tr><td><p class="active-room">${msg.clients[i].username}</p></td><td style="text-align: right;"><i id="status-icon" class="fas fa-circle" style="color: green;"></tr>`);
            } else{
                $("#users table").append(`<tr><td><p>${msg.clients[i].username}</p></td><td style="text-align: right;"><a href="#" class="fas fa-volume-mute mute" style="display: none;"></a> <a href="#" class="fas fa-volume-up unmute" style="display: none;"></a> <a href="#" class="fas fa-sync sync"></a> <i id="status-icon" class="fas fa-circle status" style="color: red;"></i> <span class="ping"></span></tr>`);
            }
        }
    });

    /************ Helper functions *************/
    // Play the stream in a audio html elem
    function playStream(stream) {
        var audio = $('<audio autoplay />').appendTo('body');
        audio[0].srcObject = stream;
    }

    // Display message from other users
    function display(message) {
        $('#messages').append($('<li>').text(message));
    }

    // Display message from the server in italic
    function info(message) {
        $('#messages').append($('<li>').text(message).attr("class", "server_info"));
    }
});