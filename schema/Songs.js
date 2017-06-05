"use strict";
/*
 *  Defined the Mongoose Schema and return a Model for a Song
 */

var mongoose = require('mongoose');

var upvoteSchema = new mongoose.Schema({ ip: 'String' });

var songSchema = new mongoose.Schema({
	spotifyId: String,  // TODO: Figure out type based on which API we are using
		//TODO: Make this a required field
	upvotes: [upvoteSchema],

	name: String,
	artist: String
});

songSchema.methods.upvote = function(ip, callback) {
	this.upvotes.push({ip: ip});
	this.save(callback);
};

songSchema.methods.downvote = function(ip, callback) {
	var i = this.upvotes.findIndex(function(upvote) {
		return upvote.ip === ip;
	});
	if(i === -1) { console.log("Couldn't find upvote with given ip to remove"); }
	
	this.upvotes.splice(i, 1);
	this.save(callback);
};

// Create model for schema
var Song = mongoose.model('Song', songSchema);

// make this available to our users in our Node applications
module.exports = Song;
