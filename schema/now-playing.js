"use strict";

var mongoose = require('mongoose');

var nowPlayingSchema = new mongoose.Schema({
	id: String,  // If id === '', then there is no song currently playing.
	songName: String,
	artist: String,
	albumId: String,

	isPlaying: Boolean,
	timeResumed: Number,  // timestamp
	resumedSeekPos: Number // time offset from beginning of song
});

var NowPlaying = mongoose.model('NowPlaying', nowPlayingSchema);

module.exports = NowPlaying;
