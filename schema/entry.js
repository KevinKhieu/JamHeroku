"use strict";
/*
 *  Defined the Mongoose Schema and return a Model for a Song
 */

var mongoose = require('mongoose');

var upvoteSchema = new mongoose.Schema({ ip: 'String' });

// Entry Schema used in backend
var entrySchema = new mongoose.Schema({
	id: String,
	songName: String,
	artist: String,
	upvotes: [upvoteSchema],
	albumId: String,
	userAdded: String
});

entrySchema.methods.upvote = function(ip, callback) {
	var i = this.upvotes.findIndex(function(upvote) {
		return upvote.ip === ip;
	});
	if(i === -1) {
		this.upvotes.push({ip: ip});
		this.save(callback);
	} else {
		callback({message: "The given ip already upvoted this song."});
	}
};

entrySchema.methods.downvote = function(ip, callback) {
	var i = this.upvotes.findIndex(function(upvote) {
		return upvote.ip === ip;
	});
	if(i === -1) {
		callback({message: "Couldn't find upvote with given ip to remove."});
	} else {
		this.upvotes.splice(i, 1);
		this.save(callback);
	}
};

// Create model for schema
var Entry = mongoose.model('Entry', entrySchema);

// make this available to our users in our Node applications
module.exports = Entry;
