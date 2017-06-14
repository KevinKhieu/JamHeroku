'use strict';

/* Entry point for Angular app. */

var jamApp = angular.module('jamApp', ['ui.router', 'songServices', 'ngResource']);

jamApp.config([
'$stateProvider',
'$urlRouterProvider','$locationProvider',
function($stateProvider, $urlRouterProvider, $locationProvider) {

	$stateProvider
		.state('client', {
			url: '/app/:roomId',
			templateUrl: '/client.html',
			controller: 'MainController'
		})

		.state('host', {
			url: '/host/:roomId/:hostId',
			templateUrl: '/host.html',
			controller: 'MainController'
		})

		.state('landing', {
			url: '/landing',
			templateUrl: '/landing.html',
			controller: 'LandingController'
		});

	$urlRouterProvider.otherwise('/landing');
 	// $locationProvider.html5Mode(true);
}]);
