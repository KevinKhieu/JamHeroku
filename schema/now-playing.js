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
	NowPlaying.reset();
};

NowPlaying.get = function(callback) {
	NowPlayingModel.findOne(function(err, np) {
		if(err) {
			console.log(err.message);
		} else {
			callback(np);
		}
	});
};

/* Sets AND pushes NowPlaying to all connected clients */
NowPlaying.set = function(newNowPlaying) {
	NowPlaying.get(function(np) {
		np.cycle(newNowPlaying, function(err, np) {
			console.log("Broadcasting push:now-playing...");
			NowPlaying.io.emit('push:now-playing', np);
		});
	});
};

NowPlaying.push = function(transport) {
	NowPlaying.get(function(np) {
		transport.emit('push:now-playing', np);
	});
};

NowPlaying.clear = function() {
	NowPlaying.set(NOTHING_PLAYING);
};

NowPlaying.reset = function() {
	NowPlaying.get(function(np) {
		np.reset(function(err, np) {
			console.log("successfully reset Now Playing in database");
			if(NowPlaying.io) {
				console.log("Broadcasting push:now-playing...");
				NowPlaying.io.emit('push:now-playing', np);
			}
		});
	});
};

module.exports = NowPlaying;
