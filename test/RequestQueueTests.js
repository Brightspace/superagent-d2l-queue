var assert = require( 'assert' );
var nock = require( 'nock' );
var requestQueue = require( '../lib/RequestQueue' );
var sinon = require( 'sinon' );
var q = require( 'q' );

var SUCCESS_RESPONSE = 'SUCCESS';
var ERROR_RESPONSE = 'ERROR';
var TIMEOUT_RESPONSE = 'ECONNABORTED';


function mockSuccessGet() {
	nock( 'http://test.domain' )
		.get( '/me' )
		.reply( 200, {
			response: SUCCESS_RESPONSE
		});
}

function mockFailedGet() {
	nock( 'http://test.domain' )
		.get( '/me' )
		.reply( 400, function() {
			return ERROR_RESPONSE;
		});
}

describe( 'RequestQueue', function() {

	describe( 'send()', function() {

		function createGetRequest( useQueue ) {
			return 	{
				url: 'http://test.domain/me',
				method: 'GET',
				useQueue: useQueue
			};
		}

		beforeEach( function() {
			sinon.spy( requestQueue, '_handleResponseWithQueue' );
		});

		afterEach( function() {
			requestQueue._handleResponseWithQueue.restore();
		})
		
		it( 'send get request, expect success and no queue used', function() { 

			mockSuccessGet(); 
			
			return requestQueue.send( createGetRequest( false ) )
					.then( function( result ) {
						assert.equal( requestQueue._handleResponseWithQueue.calledOnce, false );
						assert.equal( result.response, SUCCESS_RESPONSE );
					});
		});

		it( 'send get request, expect success and queue used' , function() {

			mockSuccessGet(); 

			return requestQueue.send( createGetRequest( true ) )
					.then( function( result ) {
						assert( requestQueue._handleResponseWithQueue.calledOnce );
						assert.equal( result.response, SUCCESS_RESPONSE );
					});
		});

		it( 'send get request, expect 400 and promise should be rejected', function() {

			mockFailedGet();

			return requestQueue.send( createGetRequest( false ) )
					.fail( function( result ) {
						assert.equal( result.response.error.status, 400 );
						assert.equal( result.response.error.text, ERROR_RESPONSE )
					});
		});

		it( 'send get request, expect server timeout, retry request and expect success', function() {

			this.timeout( 20000 );

			nock( 'http://test.domain' )
				.get( '/me' )
				.delayConnection( 16000 )
				.reply( 200, 'timeout' )
				.get( '/me' )
				.reply( 200, { response: SUCCESS_RESPONSE } )

			return requestQueue.send( createGetRequest( true ) )
					.progress( function( result ) {
						assert.equal( result.code, TIMEOUT_RESPONSE );
					})
					.then( function( result ) {
						assert.equal( result.response, SUCCESS_RESPONSE );
					});
		});
	});

	describe( '_handleResponseWithQueue()', function() {

		function createQueue( numItems ) {
			var queue = [];

			for( var i = 0; i < numItems; i++ ){
				queue.push(
					{
						url: '/me',
						method: 'GET',
						useQueue: true,
						deferred: q.defer()
					}
				);
			}

			return queue;
		}

		beforeEach( function() {
			sinon.spy( requestQueue, '_sendRequest' );
		});

		afterEach( function() {
			requestQueue._sendRequest.restore();
		})

		it( '2 requests in queue, expect _sendRequest called once', function() {

			var queue = createQueue( 2 );
			
			mockSuccessGet(); 

			requestQueue.queue = queue;

			requestQueue._handleResponseWithQueue( queue[0], 'Response 1 complete' );

			assert(  requestQueue._sendRequest.calledOnce );
		});

		it( '1 request in queue, expect sendRequest not to be called', function() {

			var queue = createQueue( 1 );

			mockSuccessGet(); 

			requestQueue.queue = queue;

			requestQueue._handleResponseWithQueue( queue[0], 'Response 1 complete' );

			assert.equal( requestQueue._sendRequest.calledOnce, false );
		});
	});

	describe( '_retry()', function() {
		it( 'request retry, expect _sendRequest to be called after 2 seconds', function() {
			
			sinon.spy( requestQueue, '_sendRequest' );

			var clock = sinon.useFakeTimers();
			
			mockSuccessGet();

			var request = {
				url: '/me',
				method: 'GET',
				useQueue: true,
				deferred: q.defer()
			};

			requestQueue._retry( request );

			clock.tick( 2000 );

			assert( requestQueue._sendRequest.calledOnce );

			requestQueue._sendRequest.restore();

			clock.restore();
		})
	})
});