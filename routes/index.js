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

function pushQueue(transport) {
	/* Gets the entire song queue from the database and emits it via the given
	 * transport as a push:queue. The transport should either be a socket, or the
	 * io object itself. A socket to send to that socket; io to send to all sockets. */
	Entry.find(function(err, songs) {
		if(err) {
			handleError(transport, err.message, "Failed to retrieve song list.");
		} else {
			console.log('emitting push:queue: ' + songs.length + ' items in queue');
			transport.emit('push:queue', songs);
		}
	});
}

function applyVote(n, songId, ip, transport) {
	console.log('user at ip ' + ip + ' ' + n + 'voted ' + songId);

	Entry.findOne({'id': songId}, function(err, song) {
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

	var room_id = "";

	socket.on('send:join-room', function(room) {
		console.log("client joining room " + room.url);
		socket.join(room.url);
		room_id = room.url;
	});

	var is_room_host = false;
	socket.on('send:i-am-room-host', function() {
		is_room_host = true;
		console.log('room host connected');
	});

	var ip = getIP(socket);
	socket.emit('send:your-ip', ip);

	console.log('a user connected with IP ' + ip + '.');

	pushQueue(socket);
	NowPlaying.push(socket);

	socket.on('disconnect', function() {
		console.log('a user disconnected');
		if(is_room_host) {
			console.log('room host disconnected! Clearing now playing.');
			NowPlaying.clear();
		}
	});

	// ADDING SONG //
	socket.on('send:add-song', function(song) {
		console.log("received send:add-song: " + song.songName + " by " + song.artist);
		var song = new Entry(song);
		song.save(function(err, song) {
			if(err){
				handleError(socket, err.message, "Failed to add song to list.");
			} else {
				console.log("Broadcasting push:add-song...");
				io.in(room_id).emit('push:add-song', song);
			}
		});
	});

	// REMOVING SONG //
	socket.on('send:remove-song', function(data) {
		console.log('removing song: ' + data.id);
		Entry.findOne({ id:data.id }).remove(function(err) {
			if(err) {
				handleError(socket, err.message, "DB: Failed to remove song from queue.");
			} else {
				console.log("Successfully removed song from DB queue.");
				io.in(room_id).emit('push:remove-song', data);
			}
		});
	});

	// UPVOTING //
	socket.on('send:upvote', function(data) {
		applyVote('up', data.id, ip, io.in(room_id));
	});

	// DOWNVOTING //
	socket.on('send:downvote', function(data) {
		applyVote('down', data.id, ip, io.in(room_id));
	});

	// MEDIA CONTROL FROM ROOM HOST //

	socket.on('send:now-playing', function(data) {

		if(data) {  // True unless we've reached the end of the queue
			console.log('now playing: ' + data.id);
			Entry.findOne({ id:data.id }).remove(function(err) {
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
							NowPlaying.set(data, room_id);
						});
					});
				}
			});
		} else {  // we've reached the end of the queue
			NowPlaying.clear(room_id);
		}
	});

	// socket.on('send:resumed-time', function(data) {
	// 	console.log('received send:resume-time: ');
	// 	console.dir(data);
	// 	NowPlaying.get(function(np) {
	// 		np.resumedSeekPos = data.resumedSeekPos;
	// 		np.timeResumed = data.timeResumed;
	// 		np.save();
	// 	});
	// });

	socket.on('send:play', function(data) {
		console.log('music is now playing');
		NowPlaying.get(function(np) {
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
				socket.broadcast.to(room_id).emit('push:play', data);
			});
		});
	});

	socket.on('send:pause', function() {
		console.log('music is now paused');
		NowPlaying.get(function(np) {
			np.isPlaying = false;
			np.save(function(np) {
				socket.broadcast.to(room_id).emit('push:pause');
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
		Room.findOne({name: data.name}, function(err, room) {
			if(err) {
				handleError(socket, err.message, "Error searching for room with name " + data.name);
			} else {
				if(room) {
					// room is already taken
					socket.emit('respond:create-room', {url: null});
				} else {
					// create new room
					room = new Room({name: data.name, url: data.name});
					room.save(function(err, room) {
						if(err) {
							handleError(socket, err.message, "Error creating room");
						} else {
							socket.emit('respond:create-room', {url:room.url});
						}
					});
				}
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
			console.log('  successfully removed all songs from database');

			pushQueue(io.in(room_id));
		});

		NowPlaying.reset(room_id);
	});
})};
