'use strict';

/* Entry point for Angular app. */

var jamApp = angular.module('jamApp', ['controller', 'ui.router','ngRoute']);

// jamApp.config(['$routeProvider',
//     function ($routeProvider) {
//         $routeProvider.
//             when('/home', {
//                 templateUrl: '../index.html',
//                 controller: 'MainController'
//             }).
//             when('/landing', {
//                 templateUrl: '../landing.html',
//                 controller: 'LandingController'
//             }).
//             otherwise({
//                 redirectTo: '/landing'
//             });
//     }]);

jamApp.config([
'$stateProvider',
'$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {

	$stateProvider
		.state('home', {
			url: '/home',
			templateUrl: '/home.html',
			controller: 'MainController'
		})

		.state('landing', {
			url: '/landing',
			templateUrl: '/landing.html',
			controller: 'LandingController'
		});

	$urlRouterProvider.otherwise('home');
}]);
