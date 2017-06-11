'use strict';

// var Song = require('../schema/Songs');
var Entry = require('../schema/entry');
var NowPlaying = require('../schema/now-playing');
var LastPlayed = require('../schema/last-played');
var hardcodedMusicData = require('../data.json');
var googlePlayAPI = require('../google-music/googleMusic');
var PlayMusic = require('../google-music/play');

// Initialize Google Music API
var pm = new PlayMusic();
googlePlayAPI.initialize(pm, function() {
	console.log('successfully initialized google play api');
}, function(err) {
	console.log("HEYYY");
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

function getNowPlaying(callback) {
	NowPlaying.findOne(function(err, np) {
		if(err) {
			handleError(undefined, err.message, "Failed to get NowPlaying db data");
		} else {
			callback(np);
		}
	});
}

function getLastPlayed(callback) {
	LastPlayed.findOne(function(err, lp) {
		if(err) {
			handleError(undefined, err.message, "Failed to get LastPlayed db data");
		} else {
			callback(lp);
		}
	});
}

function setNowPlaying(newNowPlaying, callback) {
	getNowPlaying(function(np) {
		np.id = newNowPlaying.id;
		np.songName = newNowPlaying.songName;
		np.artist = newNowPlaying.artist;
		np.albumUrl = newNowPlaying.albumUrl;
		np.isPlaying = newNowPlaying.isPlaying;
		np.timeResumed = newNowPlaying.timeResumed;
		np.resumedSeekPos = newNowPlaying.resumedSeekPos;
		np.save(callback);
	});
}

function setLastPlayed(newLastPlayed, callback) {
	getLastPlayed(function(lp) {
		lp.id = newLastPlayed.id;
		lp.songName = newLastPlayed.songName;
		lp.artist = newLastPlayed.artist;
		lp.save(callback);
	});
}

function initNowPlaying() {
	getNowPlaying(function(np) {
		if(np == null) {
			NowPlaying.create({
				id: '',
				songName: '',
				artist: '',
				albumUrl: '',

				isPlaying: false,
				// timeResumed: undefined,  // not set yet
				resumedSeekPos: 0
			});
		}
	});
}
initNowPlaying();

function initLastPlayed() {
	getLastPlayed(function(lp) {
		if(lp == null) {
			LastPlayed.create({
				id: '',
				songName: '',
				artist: ''
			});
		}
	});
}
initLastPlayed();

function pushNowPlaying(transport) {
	getNowPlaying(function(np) {
		getLastPlayed(function(lp) {
			transport.emit('push:now-playing', { np: np, lp: lp });
		});
	});
}

function getIP(socket) {
	return socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
}

exports.initSocketConnection = function(io) {
io.sockets.on('connection', function(socket) {

	var ip = getIP(socket);
	socket.emit('send:your-ip', ip);

	console.log('a user connected with IP ' + ip + '.');

	pushQueue(socket);
	pushNowPlaying(socket);

	socket.on('disconnect', function() {
		console.log('a user disconnected');
	});

	// ADDING SONG //
	socket.on('send:add-song', function(song) {
		console.log("received send:add-song: ");
		console.dir(song);
		var song = new Entry(song);
		song.save(function(err, song) {
			if(err){
				handleError(socket, err.message, "Failed to add song to list.");
			} else {
				console.log("Broadcasting push:add-song...");
				io.emit('push:add-song', song);
			}
		});
	});

	// UPVOTING //
	socket.on('send:upvote', function(data) {
		applyVote('up', data.id, ip, io);
	});

	// DOWNVOTING //
	socket.on('send:downvote', function(data) {
		applyVote('down', data.id, ip, io);
	});

	// MEDIA CONTROL FROM ROOM HOST //

	socket.on('send:now-playing', function(data) {
		console.log('now playing: ' + data.np.id);
		console.log('album id: ' + data.np.albumId);
		Entry.findOne({ id:data.np.id }).remove(function(err) {
			if(err) {
				handleError(socket, err.message, "DB: Failed to remove now-playing song from queue.");
			} else {
				console.log("Successfully removed now-playing song from DB queue.");
				if(data.lp.artist === "") data.lp.artist = "No Previous Song";

				// Get urls of Now Playing song
				googlePlayAPI.getStreamURL(pm, data.np, function(songUrl) {
					googlePlayAPI.getAlbumURL(pm, data.np, function(albumUrl) {
						data.np.albumUrl = albumUrl;

						setLastPlayed(data.lp, function(err, lastPlayed) {
							setNowPlaying(data.np, function(err, nowPlaying) {
								console.log("Broadcasting push:now-playing...");
								io.emit('push:now-playing', {
									np: nowPlaying,
									lp: lastPlayed,
									npUrl: songUrl
								});
							});
						});
					});
				});
			}
		});
	});

	socket.on('send:play', function() {
		console.log('music is now playing');
		getNowPlaying(function(np) {
			np.isPlaying = true;
			np.save(function(np) {
				socket.broadcast.emit('push:play');
			});
		});
	});

	socket.on('send:pause', function() {
		console.log('music is now paused');
		getNowPlaying(function(np) {
			np.isPlaying = false;
			np.save(function(np) {
				socket.broadcast.emit('push:pause');
			});
		});
	});

	/* Dedupes any two adjacent songs with same name and artist. */
	function filterUniques(results) {
		var unique_songs = [];
		for (var i = 0; i < results.length - 1; i+=2) {
			if (results[i].songName === results[i + 1].songName && results[i].artist === results[i + 1].artist) {
				console.log('detected duplicate');
				unique_songs.push(results[i+1]);
			} else {
				unique_songs.push(results[i]);
				unique_songs.push(results[i+1]);
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

	// RESET
	socket.on('send:reset', function() {
		console.log("RESETTING DB...");

		// reset queue
		Entry.remove({}, function(err) {
			if (err) {
				return handleError(socket, err.message, "Failed to remove all songs from database.");
			}
			console.log('  successfully removed all songs from database');

			pushQueue(io);
			// // re-add hardcoded data
			// Entry.create(hardcodedMusicData, function(err) {
			// 	if(err) {
			// 		handleError(socket, err.message, "Failed to add hardcoded data to database.");
			// 	} else {
			// 		console.log('  successfully re-added hardcoded music data');
			// 		pushQueue(io);
			// 	}
			// });
		});

		// clear now playing
		setNowPlaying({
			id: '',
			songName: '',
			artist: '',
			albumUrl: '',

			isPlaying: false,
			// timeResumed: undefined,  // not set yet
			resumedSeekPos: 0
		}, function(err, np) {
			if(err) {
				handleError(socket, err.message, "Failed to set now playing in database.");
			} else {
				setLastPlayed({
					id: '',
					songName: '',
					artist: '',
				}, function(err, lp) {
					if(err) {
						handleError(socket, err.message, "Failed to set last played in database.");
					} else {
						console.log('  successfully cleared DB now playing and last played');
						pushNowPlaying(io);
					}
				});
			}
		});

	});
})};
