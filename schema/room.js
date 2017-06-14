"use strict";
/*
 *  Defined the Mongoose Schema and return a Model for a Room
 */

var mongoose = require('mongoose');

// Entry Schema used in backend
var roomSchema = new mongoose.Schema({
	roomName: String,
	hostKey: String
});

// Create model for schema
var Room = mongoose.model('Room', roomSchema);

// make this available to our users in our Node applications
module.exports = Room;
