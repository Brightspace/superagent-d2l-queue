var superagent = require( 'superagent' ),
	should = require( 'should' ),
	sinon = require( 'sinon' ),
	express = require( 'express' );

var SUCCESS_RESPONSE = 'SUCCESS';
var ERROR_RESPONSE = 'ERROR';
var TIMEOUT_RESPONSE = 'ECONNABORTED';

var shouldTimeout;
var concurrentRequests;
var retryRequests;

var app = express();
app.listen( 5000 );

app.get( '/successWithDelay', function( req, res ) {
	concurrentRequests++;

	setTimeout( function() {
		res.status( 200 ).send( SUCCESS_RESPONSE );
	}, 500 );
});

app.get( '/failure', function( req, res ) {
	res.sendStatus( 404 );
});

app.get( '/timeout', function( req, res ) {
	retryRequests++;
	if ( retryRequests > 2 ) {
		res.status( 200 ).send( SUCCESS_RESPONSE );
	}
});

app.get( '/gatewayFailure', function( req, res ) {
	retryRequests++;
	if ( retryRequests > 2 ) {
		res.status( 200 ).send( SUCCESS_RESPONSE );
		return;
	}
	res.sendStatus( 503 );
});

describe( 'RequestQueue', function() {

	describe( 'Invocation Tests', function() {
		it( 'adds queue', function() {
			( undefined == superagent.Request.prototype.queue ).should.be.true;
		    require('../lib/index');
	   		(undefined == superagent.Request.prototype.queue).should.be.false;
		});

		it( 'adds retryOnConnError', function() {
			( undefined == superagent.Request.prototype.retryOnConnectionFailure ).should.be.true;
		    require('../lib/index');
	   		(undefined == superagent.Request.prototype.retryOnConnectionFailure ).should.be.false;
		});

		it( 'add retryOnConnectionFailure handler', function() {
			 require('../lib/index');

			 var handler = function() { var i = 1; };

			 var request = superagent
			 					.get( '/' )
			 					.retryOnConnectionFailure( handler );

			 request.retryEnabled.should.be.true;
			 request.connectionErrorHandler.should.equal( handler );
		});

		it( 'add queue', function() {
			require( '../lib/index' );

			var request = superagent
							.get( '/' )
							.useQueue();

			request.queueRequest.should.be.true;
		});
	});

	describe( 'Request Tests', function() {

		beforeEach( function() {
			require( '../lib/index' );
			concurrentRequests = 0;
			retryRequests = 0;
		})

		it( 'no queue ', function( done ) {

			this.timeout( 10000 );

			var requestsLeft = 3;

			var concurrencyChecker = setInterval( function() {
				concurrentRequests.should.equal( 3 );
			}, 200 );

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					requestsLeft--;
					if ( requestsLeft === 0 ) {
						done();
						clearInterval( concurrencyChecker );
					}
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					requestsLeft--;
					if ( requestsLeft === 0 ) {
						done();
						clearInterval( concurrencyChecker );
					}
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					requestsLeft--;
					if ( requestsLeft === 0 ) {
						done();
						clearInterval( concurrencyChecker );
					}
				});
		});

		it( 'use queue', function( done ) {

			this.timeout( 10000 );

			var requestsLeft = 5;

			var concurrencyChecker = setInterval( function() {
				concurrentRequests.should.equal( 1 );
			}, 200 );

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					requestsLeft.should.equal( 4 );
					res.text.should.equal( SUCCESS_RESPONSE );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					requestsLeft.should.equal( 3 );
					res.text.should.equal( SUCCESS_RESPONSE );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					requestsLeft.should.equal( 2 );
					res.text.should.equal( SUCCESS_RESPONSE );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					requestsLeft.should.equal( 1 );
					res.text.should.equal( SUCCESS_RESPONSE );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					requestsLeft.should.equal( 0 );
					res.text.should.equal( SUCCESS_RESPONSE );
					clearInterval( concurrencyChecker );
					done();
				});
		});

		it( 'use queue and 404 response, expect 4 failures', function( done ) {

			var failureCount = 0;

			superagent
				.get( 'http://localhost:5000/faiure' )
				.useQueue()
				.end( function( err, res ) {
					failureCount++;
					err.status.should.equal( 404 );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.useQueue()
				.end( function( err, res ) {
					failureCount++;
					err.status.should.equal( 404 );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.useQueue()
				.end( function( err, res ) {
					failureCount++;
					err.status.should.equal( 404 );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.useQueue()
				.end( function( err, res ) {
					failureCount++;
					failureCount.should.equal( 4 );
					err.status.should.equal( 404 );
					done();
				});
		});

		it( 'use queue, request timedout', function( done ) {

			this.timeout( 10000 );

			var handler = function( err ) {
				err.code.should.equal( TIMEOUT_RESPONSE );
			}

			superagent
				.get( 'http://localhost:5000/timeout' )
				.useQueue()
				.timeout( 100 )
				.retryOnConnectionFailure( handler )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		})


		it( 'no queue, request timedout', function( done ) {

			this.timeout( 10000 );

			var handler = function( err ) {
				err.code.should.equal( TIMEOUT_RESPONSE );
			}

			superagent
				.get( 'http://localhost:5000/timeout' )
				.timeout( 100 )
				.retryOnConnectionFailure( handler )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		})

		it( 'use queue, gateway error', function( done ) {

			this.timeout( 10000 );

			var handler = function( err ) {
				err.status.should.equal( 503 );

			}

			superagent
				.get( 'http://localhost:5000/gatewayFailure' )
				.useQueue()
				.timeout( 100 )
				.retryOnConnectionFailure( handler )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		})
	});
});