'use strict';

/* Soundcloud API initialization. */

// $(document).ready(function() {
// 	// initialization
// 	SC.initialize({
// 		client_id: "15c5a12b5d640af73b16bd240753ffbb"
// 	});

// 	// Play audio
// 	$("#embedTrack").click(function() {
// 		var player = $("#player");
// 		SC.oEmbed('https://soundcloud.com/mureed-abbas-shah/sami-meri-waar-by-qb-umair', {
// 			maxheight: 200
// 		}, function(res) {
// 			$("#player").html(res.html);
// 		});
// 	});

// 	// SC.get('/tracks', {
// 	// 	q: 'Boyce Avenue',
// 	// 	license: 'cc-by-sa'
// 	// 	}, function(tracks) {
// 	// 		console.log(tracks);
// 	// 	});

// 	SC.stream('/tracks/293').then(function(player){
// 		player.play();
// 	});
// });

  //     // 2. This code loads the IFrame Player API code asynchronously.
  //     var tag = document.createElement('script');

  //     tag.src = "https://www.youtube.com/iframe_api";
  //     var firstScriptTag = document.getElementsByTagName('script')[0];
  //     firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  //     // 3. This function creates an <iframe> (and YouTube player)
  //     //    after the API code downloads.
  //     var player;
  //     function onYouTubeIframeAPIReady() {
  //       player = new YT.Player('player', {
  //         height: '1',
  //         width: '1',
  //         videoId: 'XZDyMJhd4Bo',
  //         events: {
  //           'onReady': onPlayerReady,
  //           'onStateChange': onPlayerStateChange
  //         }
  //       });
  //     }

  //     // 4. The API will call this function when the video player is ready.
  //     function onPlayerReady(event) {
  //       // event.target.playVideo();
  //     }

  //     // 5. The API calls this function when the player's state changes.
  //     //    The function indicates that when playing a video (state=1),
  //     //    the player should play for six seconds and then stop.
  //     var done = false;
  //     function onPlayerStateChange(event) {
  //       if (event.data == YT.PlayerState.PLAYING && !done) {
  //         done = true;
  //       }
  //     }
  //     function stopVideo() {
  //       player.pauseVideo();
  //     }

		// function playVideo() {
		// 	player.playVideo();
		// }
