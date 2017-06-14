'use strict';

jamApp.controller('MainController', [
	'$scope',
	'songs',
	'socket',
	'socket-controller',
	'$location',
	'$stateParams',
	'$resource',
	function($scope, songs, socket, socket_controller, $location, $stateParams, $resource) {
		//console.log($stateParams.hostId);
		$scope.main = {};
		var hostId = $stateParams.hostId;
		var roomId = $stateParams.roomId;

		
		console.log(roomId);
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
		$scope.main.hasPlayed = false;

		$scope.main.queuedSong = null;		// STORES QUEUED SONG ID
		$scope.main.currDropdown = null;

		$scope.main.thisIsHost = document.getElementById("THIS_IS_HOST") != null;
		$scope.main.isStreaming = false;

		if ($scope.main.thisIsHost) {
			console.log("here")
			if (!hostId || !roomId || invalidHostId(hostId) || invalidRoomId(roomId)) {
				$location.path("/landing");
			}
		} else {
			if (!roomId || invalidRoomId(roomId)) {
				$location.path("/landing");
			}
		}
		function invalidHostId(id) {
			return false;
		}

		function invalidRoomId(id) {
			return false;
		}

		/* EVENT HANDLERS */
		$scope.main.toggleClick = function($event, id) {

			// Figured out the liking glitch! Different parts of the heart are considered
			// the event target depending on exactly where you click.
			if ($event.target.classList.contains('liked')
			 || $event.target.parentElement.classList.contains('liked')
			 || $event.target.parentElement.parentElement.classList.contains('liked')
			) {
				// we will 'unlike' it
				socket.emit('send:downvote', {'id': id} );
				songs.iVoted(id, false);
			} else {
				// we will 'like' it
				socket.emit('send:upvote', {'id': id} );
				songs.iVoted(id, true);
			}

			console.log("heart clicked for " + id);
		};

		$scope.main.addClick = function($event, id, index) {
			if ($event.target.classList.contains('add')
			 || $event.target.parentElement.classList.contains('add')
			 || $event.target.parentElement.parentElement.classList.contains('add')
			) {
				$scope.addSong($scope.main.searchList[index]);
				$event.target.classList.remove('add')
				 $event.target.parentElement.classList.remove('add')
				 $event.target.parentElement.parentElement.classList.remove('add')
			 	var x = $event.target.childNodes
			 	console.log($event.target);
			 	console.log($event.target.childNodes);
			 	if ($event.target.childNodes.length > 0) {
			 		$event.target.childNodes[1].src = "img/check.png"
			 	} else {
			 		$event.target.src = "img/check.png"
			 	}
			
			} else {
				console.log("Already added");
			}

			// console.log("heart clicked for " + id);
		};

		$scope.main.playlist = songs.songs;

		// SEARCHING AND ADDING SONGS //

		function search() {
			socket.emit("get:search", {query: $scope.searchString});
			//$scope.searchString = '';
		}

		var typingTimer;                //timer identifier
		var doneTypingInterval = 200;  //time in ms (5 seconds)
		// On press enter in the search bar, call search()
		$("#search_bar").on('keyup', function (e) {
			// if (e.keyCode == 13) {
			// 	$scope.$apply(search);
			// }
			clearTimeout(typingTimer);
			if (this.value) {
				typingTimer = setTimeout(doneTyping, doneTypingInterval);

				function doneTyping() {
					$scope.$apply(search);
					$scope.main.searchResults = true;
				}

			} else {
				console.log("EMPTY");
				$scope.$apply(function() {
					$scope.main.searchResults = false;
				});
			}
		});

		document.addEventListener('click', function(e) {
			var el = $(e.target);

			if (el.parents('div#targetArea').length) {

			} else {
				$scope.searchString = '';
				hideOptions();
				$("#search_bar").value = '';
				
				$scope.$apply(function() {
					$scope.main.searchResults = false;
				});
			}
		});

		function filterOutSongsAlreadyAdded(results) {
			var newResults = [];
			results.forEach(function(result) {
				if (!songs.contains(result.id)) {
					newResults.push(result);
				}
			});
			return newResults;
		}

		$scope.addSong = function(song) {
			console.log('adding song: ' + song.id);
			socket.emit('send:add-song', song);
			// $("#search_bar").value = '';
			// $scope.main.searchResults = false;
		};
		$scope.main.audPlay = function() {
			var aud = document.getElementById("audioElement");
			aud.src = './music/Alive.mp3';
			aud.play();
			aud.pause();
			$scope.main.hasPlayed = !$scope.main.hasPlayed;
			
			// hi
		}
		// PLAYBACK SECTION //

		// When host starts playing music, send timestamp for playback synchronization
		var aud = document.getElementById("audioElement");
		aud.onplay = function() {

			if($scope.main.thisIsHost) {
				var timeResumed = Date.now() / 1000;  // timestamp
				var resumedSeekPos = aud.currentTime;  // time offset from beginning of song
				socket.emit('send:play', {
					resumedSeekPos: resumedSeekPos,
					timeResumed: timeResumed
				});
				// _logEndTime(resumedSeekPos, timeResumed, aud.duration);
			} else {
				if(!$scope.main.nowPlaying.isPlaying) {
					aud.pause();
					return;
					// This can happen if the song is paused when the user loads the page.
				}

				if($scope.main.nowPlaying.timeResumed) {
					// if timeResumed is undefined, the event we received was the original one
					// fired when the host started playing the song, and we should just
					// start the song at the beginning.
					_synchronizeSeekPosition();
				} else {
					var timeResumed = Date.now() / 1000;  // timestamp
					var resumedSeekPos = aud.currentTime;  // time offset from beginning of song
					// _logEndTime(resumedSeekPos, timeResumed, aud.duration);
				}
			}
		};

		function _synchronizeSeekPosition() {
			console.log("syncing playback with host...");
			var resumedSeekPos = $scope.main.nowPlaying.resumedSeekPos;  // seconds
			var timeResumed = $scope.main.nowPlaying.timeResumed;  // seconds

			var timestamp = Date.now() / 1000;
			var latency = timestamp - timeResumed;

			var seekPos = resumedSeekPos + latency;
			aud.currentTime = seekPos;

			// console.log("resumedSeekPos: " + resumedSeekPos);
			// console.log(timestamp + " - " + $scope.main.nowPlaying.timeResumed + " = " + latency);
			// console.log('being assigned to aud.currentTime: ' + seekPos);

			// _logEndTime(seekPos, timestamp, aud.duration);
		}

		function _logEndTime(position, timestamp, duration) {
			console.log(timestamp + " + " + duration + " - " + position);
			var sum = timestamp + duration - position;
			console.log('end time: ' + sum);
		}

		function _setAsNowPlaying(newNowPlaying) {
			$scope.main.nowPlaying = newNowPlaying;

			// TODO: seek bar
		}

		function beginNextSong() {

			var song = null;
			if ($scope.main.queuedSong == null) {
				song = songs.popNext();
			} else {
				song = $scope.main.queuedSong;
				$scope.main.queuedSong = null;
				removeShimmers();
				songs.removeById(song.id);
			}
			socket.emit('send:now-playing', song);
		}

		function beginPlayback() {
			if(songs.songs.length === 0) return;

			var aud = document.getElementById("audioElement");
			aud.onended = function() { $scope.$apply(beginNextSong) };
			beginNextSong();
		};

		aud.onended = function() { 
			beginNextSong();
		};

		function play() {
			var aud = document.getElementById("audioElement");

			aud.play();
			$scope.main.nowPlaying.isPlaying = true;
			console.log('audio playing');
		};

		function pause() {
			var aud = document.getElementById("audioElement");
			aud.pause();

			$scope.main.nowPlaying.isPlaying = false;

			console.log('audio paused');
			if($scope.main.thisIsHost) {
				socket.emit('send:pause');
			}
		};

		$scope.main.togglePlay = function() {
			if($scope.main.nowPlaying.songName === "No Current Song") {
				beginPlayback();
			} else {
				if($scope.main.nowPlaying.isPlaying) {
					pause();
				} else {
					play();
				}
			}
		};

		$scope.main.Skip = function() {
			beginNextSong();
		};

		// Receive playback events from server

		socket.on('push:now-playing', function(np) {
			if(!$scope.main.thisIsHost) {  // not on host
				songs.removeById(np.id);
			}

			console.log("Now Playing: " + np.songName + " by " + np.artist);
			_setAsNowPlaying(np);
		});

		socket.on('push:play', function(data) {
			console.log('received push:play');
			$scope.main.nowPlaying.resumedSeekPos = data.resumedSeekPos;
			$scope.main.nowPlaying.timeResumed = data.timeResumed;

			if(!$scope.main.nowPlaying.isPlaying) {
				play();
			} else {
				// isPlaying may be true in the case that the host fired a play event
				// for simply updating for synchronization
			}
		});

		socket.on('push:pause', function() {
			console.log('received push:pause');
			pause();
		});

		// Receive Google Music API search results back from server
		socket.on('send:search', function(data) {
			var newResults = filterOutSongsAlreadyAdded(data.results);
			$scope.main.searchList = newResults;
		});

		// RESET DB
		$scope.main.reset = function() {
			console.log("sending reset");
			socket.emit('send:reset');
		};

		$scope.main.toggleSound = function () {
			console.log($scope.main.isStreaming);
			// if (!$scope.hasPlayed) {
			// 	aud.play();
			// 	$scope.hasPlayed = true;
			// 	_synchronizeSeekPosition();
			// }
		};

		$scope.main.showOptions = function($event, id) {
			hideOptions();
			var x = $event.target.parentElement.childNodes[1];
			$scope.main.currDropdown = x;
			console.log(x);
			if (x.className.indexOf("w3-show") == -1) {
					x.className += " w3-show";
			} else {
					x.className = x.className.replace(" w3-show", "");
			}
		}

		function hideOptions() {
			console.log($scope.main.currDropdown);
			if ($scope.main.currDropdown) {
				$scope.main.currDropdown.className = $scope.main.currDropdown.className.replace(" w3-show", "");
			}
		}

		function removeShimmers() {
			var x = document.getElementsByClassName("shimmer");
			if (x.length == 0) return;
			console.log(x)
			for (var i = 0; i < x.length; i++) {
				x[i].className = x[i].className.replace(" shimmer", "");
			}
		}

		$scope.main.queueNext = function($event, id) {
			var song = songs.getById(id);
			if(song) {
				$scope.main.queuedSong = song;
				console.log($scope.main.queuedSong);
				removeShimmers();
				console.log($event.target.parentElement.parentElement.childNodes[5]);
				$event.target.parentElement.parentElement.childNodes[5].className += " shimmer";
			}
			hideOptions();
		}

		$scope.main.removeSong = function($event, id) {
			console.log(id);
			socket.emit('send:remove-song', {id:id});
			hideOptions();
		}
}
]);
