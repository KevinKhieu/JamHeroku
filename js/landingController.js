'use strict';

angular.module('controller', ['songServices', 'ngResource']).controller('LandingController', [
	'$scope',
	'songs',
	'socket',
	'socket-controller',
	'$resource',
	function($scope, songs, socket, socket_controller, $resource) {

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
			console.log("Entering Existing Room");
			var string = $scope.searchString;
			// SOCKEt
		}

	}
]);
