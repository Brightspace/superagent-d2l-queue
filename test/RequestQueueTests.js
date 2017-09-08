'use strict';

const superagent = require( 'superagent' );
const should = require( 'should' );
const sinon = require( 'sinon' );
const express = require( 'express' );
const superagentQueue = require('../lib');

const SUCCESS_RESPONSE = 'SUCCESS';
const ERROR_RESPONSE = 'ERROR';
const TIMEOUT_RESPONSE = 'ECONNABORTED';

let shouldTimeout;
let concurrentRequests;
let retryRequests;

const app = express();
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

app.get( '/maxRetryCount', function( req, res ) {
	res.sendStatus( 503 );
});

describe( 'RequestQueue', function() {

	describe( 'Invocation Tests', function() {

		it( 'add retryOnConnectionFailure handler', function() {
			 var handler = function() { var i = 1; };

			 var request = superagent
							.get( '/' )
							.use( superagentQueue( { retryNotifier: handler, retryEnabled: true } ) );

			 request.retryEnabled.should.be.true;
			 request.retryNotifier.should.equal( handler );
		});

		it( 'add queue', function() {
			var request = superagent
							.get( '/' )
							.use( superagentQueue( { queue: [] } ) );

			request.queue.should.not.be.null;
		});
	});

	describe( 'Request Tests', function() {

		beforeEach( function() {
			concurrentRequests = 0;
			retryRequests = 0;
		});

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

			const queue = superagentQueue.makeQueue();
			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					assertSuccessAndRequestsLeft( requestsLeft, 4, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
				assertSuccessAndRequestsLeft( requestsLeft, 3, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					assertSuccessAndRequestsLeft( requestsLeft, 2, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					requestsLeft--;
					concurrentRequests--;
					assertSuccessAndRequestsLeft( requestsLeft, 1, res.text );
				});

			superagent
				.get( 'http://localhost:5000/successWithDelay' )
				.use( superagentQueue( { queue } ) )
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
			const queue = superagentQueue.makeQueue();

			superagent
				.get( 'http://localhost:5000/faiure' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					failureCount++;
					assert404andFailureCount( failureCount, 1, err.status );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					failureCount++;
					assert404andFailureCount( failureCount, 2, err.status );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					failureCount++;
					assert404andFailureCount( failureCount, 3, err.status );
				});

			superagent
				.get( 'http://localhost:5000/faiure' )
				.use( superagentQueue( { queue } ) )
				.end( function( err, res ) {
					failureCount++;
					assert404andFailureCount( failureCount, 4, err.status );
					done();
				});
		});

		it( 'use queue, request timed-out, expect successful retry', function( done ) {

			this.timeout( 10000 );

			var retryHandler = function( err ) {
				err.code.should.equal( TIMEOUT_RESPONSE );
			};

			superagent
				.get( 'http://localhost:5000/timeout' )
				.use( superagentQueue( { queue: [], retryNotifier: retryHandler, retryEnabled: true } ) )
				.timeout( 100 )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		});


		it( 'no queue, request timed-out, expect successful retry', function( done ) {

			this.timeout( 10000 );

			var retryHandler = function( err ) {
				err.code.should.equal( TIMEOUT_RESPONSE );
			};

			superagent
				.get( 'http://localhost:5000/timeout' )
				.use( superagentQueue( { retryNotifier: retryHandler, retryEnabled: true } ) )
				.timeout( 100 )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		});

		it( 'use queue, gateway error, expect successful retry', function( done ) {

			this.timeout( 10000 );

			const retryHandler = function( err ) {
				err.status.should.equal( 503 );
			};

			superagent
				.get( 'http://localhost:5000/gatewayFailure' )
				.use( superagentQueue( { queue: [], retryNotifier: retryHandler, retryEnabled: true } ) )
				.timeout( 100 )
				.end( function( err, res ) {
					res.text.should.equal( SUCCESS_RESPONSE );
					done();
				});
		});

		it( 'use queue, max count of retries hit, request should fail', function( done ) {

			this.timeout( 100000 );

			const expectedRetryCount = 10;

			let retryCount = 0;

			const retryHandler = function() {
				retryCount++;
			};

			superagent
				.get( 'http://localhost:5000/maxRetryCount' )
				.use(
					superagentQueue({
						queue: [],
						retryNotifier: retryHandler,
						retryEnabled: true,
						backoff: { retries: expectedRetryCount }
					})
				)
				.timeout( 100 )
				.end( function( err, res ) {
					should.exist( err );
					res.statusCode.should.equal( 503 );
					retryCount.should.equal( expectedRetryCount );
					done();
				});

		});

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
