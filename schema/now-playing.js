"use strict";

var mongoose = require('mongoose');

var NOTHING_PLAYING = {
	id: '',
	songName: 'No Current Song',
	artist: '',
	songUrl: '',
	albumUrl: '',
	isPlaying: false
};

var NO_LAST_PLAYED = {
	id: '',
	songName: '',
	artist: 'No Previous Song',
	songUrl: '',
	albumUrl: '',
	isPlaying: false
};

var nowPlayingSchema = new mongoose.Schema({
	roomId: String,

	/// NOW PLAYING ///

	id: String,  // If id === '', then there is no song currently playing.
	songName: String,
	artist: String,
	songUrl: String,
	albumUrl: String,

	isPlaying: Boolean,
	timeResumed: Number,  // timestamp (float seconds)
	resumedSeekPos: Number, // time offset from beginning of song (float seconds)

	/// LAST PLAYED ///

	lpId: String,
	lpSongName: String,
	lpArtist: String
});

nowPlayingSchema.methods.cycle = function(newNP, callback) {
	// set Last Played first so as not to clobber
	if(this.artist !== '') {
		this.lpId = this.id;
		this.lpSongName = this.songName;
		this.lpArtist = this.artist;
	}

	this.id = newNP.id;
	this.songName = newNP.songName;
	this.artist = newNP.artist;
	this.songUrl = newNP.songUrl;
	this.albumUrl = newNP.albumUrl;

	this.isPlaying = newNP.isPlaying;
	this.timeResumed = undefined;
	this.resumedSeekPos = 0;
	this.save(callback);
};

nowPlayingSchema.methods.reset = function(callback) {
	var npInstance = this;
	npInstance.cycle(NO_LAST_PLAYED, function(err, np) {
		npInstance.cycle(NOTHING_PLAYING, callback);
	});
};

var NowPlayingModel = mongoose.model('NowPlaying', nowPlayingSchema);

var NowPlaying = {};

NowPlaying.init = function(io) {
	NowPlaying.io = io;
};

NowPlaying.create = function(roomId, callback) {
	var np = new NowPlayingModel({roomId: roomId});
	np.reset(callback);  // saves automatically
};

NowPlaying.get = function(roomId, callback) {
	NowPlayingModel.findOne({roomId:roomId}, function(err, np) {
		if(err) {
			console.log(err.message);
		} else {
			// console.log("getting NowPlaying entry for room " + roomId);
			// console.dir(np);
			// NowPlayingModel.find({}, function(err, nps) {
			// 	console.dir(nps);
			// });
			callback(np);
		}
	});
};

/* Sets AND pushes NowPlaying to all connected clients */
NowPlaying.set = function(newNowPlaying, roomId) {
	NowPlaying.get(roomId, function(np) {
		if(np == null) return;  // can happen if access a room that doesn't exist
		np.cycle(newNowPlaying, function(err, np) {
			console.log("Set now playing: broadcasting push:now-playing for room " + roomId);
			NowPlaying.io.in(roomId).emit('push:now-playing', np);
		});
	});
};

NowPlaying.push = function(roomId, transport) {
	NowPlaying.get(roomId, function(np) {
		console.log("pushing NowPlaying entry for room " + roomId);
		// console.dir(np);
		transport.emit('push:now-playing', np);
	});
};

NowPlaying.clear = function(roomId) {
	NowPlaying.set(NOTHING_PLAYING, roomId);
};

NowPlaying.reset = function() {
	NowPlayingModel.remove({}, function(err) {
		if(err) console.log(err);
		else console.log('  successfully cleared NowPlaying table');
	});
	// NowPlaying.get(function(np) {
	// 	np.reset(function(err, np) {
	// 		console.log("successfully reset Now Playing in database");
	// 		if(NowPlaying.io) {
	// 			console.log("Broadcasting push:now-playing...");
	// 			NowPlaying.io.in(room_id).emit('push:now-playing', np);
	// 		}
	// 	});
	// });
};

module.exports = NowPlaying;
