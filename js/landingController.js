'use strict';

jamApp.controller('LandingController', [
	'$scope',
	'songs',
	'socket',
	'$location',
	'$resource',
	function($scope, songs, socket, $location, $resource) {

		$scope.main = {};

		// $scope.main.nowPlaying = {
		// 	songName: "",
		// 	artist: ""
		// };
		//
		// $scope.main.lastPlayed = {
		// 	songName: "",
		// 	artist: "No Previous Song"
		// };

		$scope.main.searchResults = false;
		$scope.main.searchList = [];
		$scope.main.imgURL = "img/noImg.png";

		$scope.main.queuedSong = null;		// STORES QUEUED SONG ID
		$scope.main.currDropdown = null;

		$scope.main.currRoomId = null;

		// SEARCHING AND ADDING SONGS //

		var typingTimer;                //timer identifier
		var doneTypingInterval = 250;  //time in ms (5 seconds)
		// On press enter in the search bar, call search()

		// send:create-room, {data: title}

		$scope.main.createRoom = function() {
			console.log("Creating New Room");
			var roomElement = $("#room_name");
			var hostElement = $("#host_key");
			var currRoomName = $scope.roomName;
			var currHostKey = $scope.hostKey;


			if (currRoomName != null && currHostKey != null && currHostKey.length != 0 && currRoomName.length != 0) {
				console.log("SENT");
				socket.emit('send:create-room', {
					roomName: currRoomName,
					hostKey: currHostKey
				});
			} else {
				console.log("Something is empty");
			}

		}

		$scope.main.enterExistingRoom = function() {
			// SOCKET - valid room?
			socket.emit('get:room-exists', {
				roomName: $scope.searchString
			});
		}

		socket.on('respond:room-exists', function(data) {
			if (data.exists) {
				console.log("Entering Existing Room");
				var str = '/app/' + data.roomName;
				console.log("room exists and has name " + data.roomName);
				$location.path(str);
			} else {
				alert("That name does not match any existing room. Please use the section below to create it.");
			}
		});

		socket.on('respond:create-room', function(data) {
			if (data.roomName != null && data.hostKey != null) {
				var str = '/host/' + data.roomName + '/' + data.hostKey;
				$location.path(str);
			} else {
				alert("That room name is already taken. Please try again.");
			}
		});

		$scope.main.reset = function() {
			socket.emit('send:reset');
		};

	}
]);
