var googleApi = require('./googleMusic');
var PlayMusic = require('./play');

var pm = new PlayMusic();

googleApi.initialize(pm, function(pm_init) {
	googleApi.search(pm, "ed sheeran shape of you", function(songs) {
		googleApi.getAlbumURL(pm, songs[0], function(url) {
			console.log(url)
		});
	});
});
