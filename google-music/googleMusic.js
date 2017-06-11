/*
 * This is the node service module that handles calls to google music API.
 */

 //This are the required services needed
var fs = require('fs');
var PlayMusic = require('./play');
var util = require('util');

// var config = JSON.parse(fs.readFileSync("./config.json"));
var config = require('./config.json');

exports.initialize = function(pm, callback) {
    function login() {
        pm.login({email: config.email, password: config.password}, function(err, resp) {
            if (err) {
                console.log("Error initializing. Retrying...")
                login();
            }
            else {
                console.log("We in!")
                pm.init({androidId: resp['androidId'], masterToken: resp['masterToken']}, function(err) {
                    if (err) {
                        console.log("Error init");
                        login();
                    }
                    else callback(pm);
                });
            }
        });
    }

    login();
};

exports.search = function(pm, song, callback) {
    pm.search(song, 10, function(err, data) {
        songs = [];
        if (err) console.log("Error searching...");
        for (var entry in data.entries) {
            if (data.entries[entry].type === '1') {
                songs.push({
                    artist: data.entries[entry].track['artist'],
                    songName: data.entries[entry].track['title'],
                    id: data.entries[entry].track['storeId'],
                    albumId: data.entries[entry].track['albumId']
                });
            }
        }
        callback(songs);
    });
};

exports.getStreamURL = function(pm, song, callback) {
    pm.getStreamUrl(song['id'], function (err, resp) {
        if (err) console.log("Error getting song url...");
        else callback(resp);
    });
};

exports.getAlbumURL = function(pm, song, callback) {
    pm.getAlbum(song['albumId'], true, function(err, data) {
        if (err) console.log("Error getting album url...");
        else callback(data.albumArtRef);
    });
}
