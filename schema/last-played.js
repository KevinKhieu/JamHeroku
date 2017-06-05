"use strict";

var mongoose = require('mongoose');

var lastPlayedSchema = new mongoose.Schema({
	id: String,  // If id === '', then there is no song currently playing.
	songName: String,
	artist: String
});

var LastPlayed = mongoose.model('LastPlayed', lastPlayedSchema);

module.exports = LastPlayed;
