'use strict';

function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
}

function didIUpvote(upvotes, myIP) {
	var i = upvotes.findIndex(function(upvote) {
		return upvote.ip === myIP;
	});
	if(i === -1) { return false; }
	return true;
}

angular.module('songServices', [])
.factory('songs', ['$http', 'socket', function($http, socket) {
	var o = {
		songs: [],  // songs are sorted by number of upvotes.
	};

	o._sort = function() {
		// Sort by upvotes
		o.songs.sort(function(a,b) {
			if(a.upvotes.length < b.upvotes.length)
				return 1;
			if(a.upvotes.length > b.upvotes.length)
				return -1;
			return 0;
		});
	}

	o._findById = function(id) {
		return o.songs.findIndex(function(song) {
			return song.id === id;
		});
	}

	/* Call to completely replace songs with A COPY OF the song data given in database format. */
	o.set = function(songDBDatas) {
		// We need to figure out if we upvoted each song
		songDBDatas.forEach(function(songData) {
			songData.iUpvoted = didIUpvote(songData.upvotes, socket.myIP);
		});

		angular.copy(songDBDatas, o.songs);
		o._sort();
	};

	/* Call to add a single song, given in database format, to songs. */
	o.add = function(songDBData) {
		songDBData.iUpvoted = didIUpvote(songDBData.upvotes, socket.myIP);

		o.songs.push(songDBData);
		o._sort();
		console.log("received push:add-song and pushed data onto local songs object.");
	};

	o.setUpvotes = function(id, upvotes) {
		var i = o._findById(id);
		o.songs[i].upvotes = upvotes;
		o.songs[i].iUpvoted = didIUpvote(upvotes, socket.myIP);
		console.log(id + ' has ' + upvotes.length + ' upvotes.');
		console.log(o);
		o._sort();
	};

	o.removeById = function(id) {
		var i = o._findById(id);
		if(i < 0) return undefined;
		return o.songs.splice(i, 1)[0];
	}

	o.popNext = function() {
		/* Returns the song with the most upvotes. */
		return o.songs.shift();
	};

	o.contains = function(id) {
		return o._findById(id) >= 0;
	}

	return o;
}])

.factory('socket', ['$rootScope', function($rootScope) {
	var socket = io.connect();
	var o = {};
	o.on = function (eventName, callback) {
		socket.on(eventName, function () {
			var args = arguments;
			$rootScope.$apply(function () {
				callback.apply(socket, args);
			});
		});
	};
	o.emit = function (eventName, data, callback) {
		socket.emit(eventName, data, function () {
			var args = arguments;
			$rootScope.$apply(function () {
				if (callback) {
					callback.apply(socket, args);
				}
			});
		});
	};

	return o;
}])

.factory('socket-controller', ['socket', 'songs', function(socket, songs) {
	/* The part of the controller that responds to socket events. Don't know better
	 * place to register with socket.on - can't do it in the controller because
	 * it gets called twice there. */

	socket.on('send:your-ip', function(ip) {
		socket.myIP = ip;
	});

	socket.on('push:queue', function(data) {
		console.log('received push:queue event');
		songs.set(data);
	});

	socket.on('push:add-song', function(data) {
		songs.add(data);
	});

	socket.on('push:upvote', function(data) {
		console.log('received push:upvote event for ' + data.id);
		// console.dir(data);
		songs.setUpvotes(data.id, data.upvotes);
	});

	socket.on('push:downvote', function(data) {
		console.log('received push:downvote event for ' + data.id);
		songs.setUpvotes(data.id, data.upvotes);
	});

	return {};
}]);
