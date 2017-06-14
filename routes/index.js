'use strict';

// var Song = require('../schema/Songs');
var Entry = require('../schema/entry');
var NowPlaying = require('../schema/now-playing');
var Room = require('../schema/room');
var googlePlayAPI = require('../google-music/googleMusic');
var PlayMusic = require('../google-music/play');

// Initialize Google Music API
var pm = new PlayMusic();
googlePlayAPI.initialize(pm, function() {
	console.log('successfully initialized google play api');
}, function(err) {
	console.log("failed to initialize google play api");
});

// Generic error handler
function handleError(transport, reason, message, code) {
	console.log("ERROR: " + message);
	console.log("\t" + reason);
	if(transport)
		transport.emit('server-error', {"reason": reason, "message": message, "code": code});
}

function pushQueue(transport, roomId) {
	/* Gets the entire song queue from the database and emits it via the given
	 * transport as a push:queue. The transport should either be a socket, or the
	 * io object itself. A socket to send to that socket; io to send to all sockets. */
	Entry.find({roomId: roomId}, function(err, songs) {
		if(err) {
			handleError(transport, err.message, "Failed to retrieve song list.");
		} else {
			console.log('emitting push:queue: ' + songs.length + ' items in queue');
			transport.emit('push:queue', songs);
		}
	});
}

function applyVote(n, songId, ip, transport, roomId) {
	console.log('user at ip ' + ip + ' ' + n + 'voted ' + songId);

	Entry.findOne({id: songId, roomId: roomId}, function(err, song) {
		if(err) {
			handleError(transport, err.message, "Failed to find song with given id to " + n + "vote.");
		} else {

			song[n + 'vote'] (ip, function(err, doc) {
				if(err) {
					handleError(transport, err.message, "Failed to " + n + "vote song.");

				} else {
					console.log("Broadcasting push:" + n + "vote...");
					transport.emit('push:' + n + 'vote', doc);
				}
			});
		}
	});
}

function getIP(socket) {
	return socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
}

exports.initSocketConnection = function(io) {

// Initialize database
NowPlaying.init(io);

// Set handlers for socket events
io.sockets.on('connection', function(socket) {
	console.log('a user connected');

	var ip = getIP(socket);
	var roomId = "";

	var is_room_host = false;
	socket.on('send:i-am-room-host', function() {
		is_room_host = true;
		console.log('room host connected');
	});

	socket.on('send:join-room', function(data) {
		// set room id
		console.log("client joining room " + data.roomId);
		socket.join(data.roomId);
		roomId = data.roomId;

		// push room data to client
		// socket.emit('send:your-ip', ip);
		pushQueue(socket, roomId);
		NowPlaying.push(roomId, socket);
	});

	socket.on('disconnect', function() {
		console.log('a user disconnected');
		if(is_room_host) {
			console.log('room host disconnected! Clearing now playing.');
			NowPlaying.clear(roomId);
		}
	});

	// ADDING SONG //
	socket.on('send:add-song', function(song) {
		console.log("received send:add-song: " + song.songName + " by " + song.artist);
		song.roomId = roomId;
		var song = new Entry(song);
		song.save(function(err, song) {
			if(err){
				handleError(socket, err.message, "Failed to add song to list.");
			} else {
				console.log("Broadcasting push:add-song...");
				io.in(roomId).emit('push:add-song', song);
			}
		});
	});

	// REMOVING SONG //
	socket.on('send:remove-song', function(data) {
		console.log('removing song: ' + data.id);
		Entry.findOne({ id:data.id, roomId:roomId }).remove(function(err) {
			if(err) {
				handleError(socket, err.message, "DB: Failed to remove song from queue.");
			} else {
				console.log("Successfully removed song from DB queue.");
				io.in(roomId).emit('push:remove-song', data);
			}
		});
	});

	// UPVOTING //
	socket.on('send:upvote', function(data) {
		applyVote('up', data.id, ip, io.in(roomId), roomId);
	});

	// DOWNVOTING //
	socket.on('send:downvote', function(data) {
		applyVote('down', data.id, ip, io.in(roomId), roomId);
	});

	// MEDIA CONTROL FROM ROOM HOST //

	socket.on('send:now-playing', function(data) {

		if(data) {  // True unless we've reached the end of the queue
			console.log('now playing: ' + data.id + " in room " + roomId);
			Entry.findOne({ id:data.id, roomId:roomId }).remove(function(err) {
				if(err) {
					handleError(socket, err.message, "DB: Failed to remove now-playing song from queue.");
				} else {
					console.log("Successfully removed now-playing song from DB queue.");

					// Get urls of Now Playing song
					googlePlayAPI.getStreamURL(pm, data, function(songUrl) {
						googlePlayAPI.getAlbumURL(pm, data, function(albumUrl) {
							data.songUrl = songUrl;
							data.albumUrl = albumUrl;
							data.isPlaying = true;
							NowPlaying.set(data, roomId);
						});
					});
				}
			});
		} else {  // we've reached the end of the queue
			NowPlaying.clear(roomId);
		}
	});

	socket.on('send:play', function(data) {
		console.log('music is now playing');
		NowPlaying.get(roomId, function(np) {
			console.dir(data);
			np.resumedSeekPos = data.resumedSeekPos;
			np.timeResumed = data.timeResumed;
			// var wasPlaying = np.isPlaying;

			np.isPlaying = true;
			np.save(function(np) {
				// if(wasPlaying) {
				// 	console.log('received play event, but was already playing, so not forwarding to clients.');
				// 	return;
				// }
				socket.broadcast.to(roomId).emit('push:play', data);
			});
		});
	});

	socket.on('send:pause', function() {
		console.log('music is now paused');
		NowPlaying.get(roomId, function(np) {
			np.isPlaying = false;
			np.save(function(np) {
				socket.broadcast.to(roomId).emit('push:pause');
			});
		});
	});


	/* Dedupes any two adjacent songs with same name and artist. */
	function duplicate(value, map) {
		return map.has(value);
	}

	function filterUniques(results) {
		var unique_songs = [];
		var map = new Map();
		for (var i = 0; i < results.length; i++) {
			if (!duplicate(results[i].artist+results[i].songName, map)) {
				unique_songs.push(results[i]);
				map.set(results[i].artist+results[i].songName, "Unique");
			}
		}
		return unique_songs;
	}
	socket.on('get:search', function(data) {
		console.log('getting search for ' + data.query);
		googlePlayAPI.search(pm, data.query, function(results) {
			results = filterUniques(results);
			socket.emit('send:search', {results: results});
		});
	});

	socket.on('send:create-room', function(data) {
		console.log('received room creation request');
		Room.findOne({roomName: data.roomName}, function(err, room) {
			if(err) {
				handleError(socket, err.message, "Error searching for room with name " + data.name);
			} else {
				if(room) {
					// room is already taken
					console.log('room already exists');
					socket.emit('respond:create-room', {roomName: null});
				} else {
					// create new room
					room = new Room(data);
					room.save(function(err, room) {
						if(err) {
							handleError(socket, err.message, "Error creating room");
						} else {
							NowPlaying.create(data.roomName, function(err, np) {
								if(err) {
									handleError(socket, err.message, "Error creating NowPlaying entry for new room");
								} else {
									// console.log("np for room " + room.roomName);
									// console.dir(np);
									socket.emit('respond:create-room', room);
								}
							});
						}
					});
				}
			}
		});
	});

	socket.on('get:room-exists', function(data) {
		console.log("received get:room-exists");
		Room.findOne(data, function(err, room) {
			if(err) {
				handleError(socket, err.message, "Error searching for room with name " + data.roomName);
			} else {
				// console.log("found room: " + room);
				// console.dir(data);
				socket.emit('respond:room-exists', {
					exists: room != null,
					roomName: data.roomName
				});
			}
		});
	});

	socket.on('get:host-exists', function(data) {
		console.log("received get:host-exists");
		Room.findOne(data, function(err, room) {
			if(err) {
				handleError(socket, err.message, "Error searching for room with name " + data.roomName);
			} else {
				// console.log("found room: " + room);
				// console.dir(data);
				socket.emit('respond:host-exists', {
					roomName: data.roomName,
					isCorrectKey: room != null && room.hostKey === data.hostKey
				});
			}
		});
	});

	// RESET
	socket.on('send:reset', function() {
		console.log("RESETTING DB...");

		// reset queue
		Entry.remove({}, function(err) {
			if (err) {
				return handleError(socket, err.message, "Failed to remove all songs from database.");
			}
			console.log('  successfully cleared song table');

			// pushQueue(io.in(roomId), roomId);
			// TODO: forward changes to all rooms, not just the one who initiated
		});

		// reset now playing
		NowPlaying.reset();

		// reset rooms
		Room.remove({}, function(err) {
			if(err) {
				return handleError(socket, err.message, "Failed to remove all rooms from database.");
			}
			console.log('  successfully cleared room table');
		})
	});
})};
