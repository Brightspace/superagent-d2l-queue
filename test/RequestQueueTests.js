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

		it( 'no queue, 3 concurrent succesfull requests ', function( done ) {

			this.timeout( 10000 );

			var requestsLeft = 3;

			var concurrencyChecker = getConcurrencyChecker( 3 );

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					requestsLeft--;
					closeTestIfNoRequests( requestsLeft, done, concurrencyChecker );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					requestsLeft--;
					closeTestIfNoRequests( requestsLeft, done, concurrencyChecker );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					requestsLeft--;
					closeTestIfNoRequests( requestsLeft, done, concurrencyChecker );
				});
		});

		it( 'use queue, expect 1 concurrent request', function( done ) {

			this.timeout( 10000 );

			var requestsLeft = 5;

			var concurrencyChecker = getConcurrencyChecker( 1 );

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					assertSuccessAndRequestsLeft( requestsLeft, 4, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
				assertSuccessAndRequestsLeft( requestsLeft, 3, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					assertSuccessAndRequestsLeft( requestsLeft, 2, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					assertSuccessAndRequestsLeft( requestsLeft, 1, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.useQueue()
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					assertSuccessAndRequestsLeft( requestsLeft, 0, res.text );
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
					assert404andFailureCount( failureCount, 1, err.status );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.useQueue()
				.end( function( err, res ) {
					failureCount++;
					assert404andFailureCount( failureCount, 2, err.status );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.useQueue()
				.end( function( err, res ) {
					failureCount++;
					assert404andFailureCount( failureCount, 3, err.status );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.useQueue()
				.end( function( err, res ) {
					failureCount++;
					assert404andFailureCount( failureCount, 4, err.status );
					done();
				});
		});

		it( 'use queue, request timedout, expect successful retry', function( done ) {

			this.timeout( 10000 );

			var retryHandler = function( err ) {
				err.code.should.equal( TIMEOUT_RESPONSE );
			}

			superagent
				.get( 'http://localhost:5000/timeout' )
				.useQueue()
				.timeout( 100 )
				.retryOnConnectionFailure( retryHandler )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		})


		it( 'no queue, request timedout, expect successful retry', function( done ) {

			this.timeout( 10000 );

			var retryHandler = function( err ) {
				err.code.should.equal( TIMEOUT_RESPONSE );
			}

			superagent
				.get( 'http://localhost:5000/timeout' )
				.timeout( 100 )
				.retryOnConnectionFailure( retryHandler )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		})

		it( 'use queue, gateway error, expect successful retry', function( done ) {

			this.timeout( 10000 );

			var retryHandler = function( err ) {
				err.status.should.equal( 503 );

			}

			superagent
				.get( 'http://localhost:5000/gatewayFailure' )
				.useQueue()
				.timeout( 100 )
				.retryOnConnectionFailure( retryHandler )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		})

		function assert404andFailureCount( failureCount, expectedFailureCount, status ) {
			failureCount.should.equal( expectedFailureCount );
			status.should.equal( 404 );
		}

		function assertSuccessAndRequestsLeft( requestsLeft, expectedRequestsLeft, response ) {
			requestsLeft.should.equal( expectedRequestsLeft );
			response.should.equal( SUCCESS_RESPONSE );
		}

		function getConcurrencyChecker( expectedConcurrency ) {
			return setInterval( function() {
				concurrentRequests.should.equal( expectedConcurrency );
			}, 200 );
		}

		function closeTestIfNoRequests( requestsLeft, done, concurrencyChecker ) {
			if ( requestsLeft === 0 ) {
				done();
				clearInterval( concurrencyChecker );
			}
		}
	});
});