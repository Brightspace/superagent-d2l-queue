var nock = require( 'nock' );
var superagent = require( 'superagent' );
var should = require( 'should' );
var sinon = require( 'sinon' );

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

function mockTimeout() {
    nock( 'http://test.domain' )
        .get( '/me' )
        .delayConnection( 5 )
        .reply( 200, 'timeout' )
        .get( '/me' )
        .reply( 200, { response: SUCCESS_RESPONSE } )

}

//TODO: Tests for queue logic

describe( 'RequestQueue', function() {
		
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
		 					.get( '/me' )
		 					.retryOnConnectionFailure( handler );

		 request.shouldRetry.should.be.true;
		 request.connErrorHandler.should.equal( handler );
	});

	it( 'connection timeout no queue', function() {
		require('../lib/index');

		var handler = function() { var i = 1; };

		var spy = sinon.spy( handler );

		mockTimeout();

		 var request = superagent
						.get( '/me' )
						.timeout( 4 )
						.retryOnConnectionFailure( handler )
						.end( function( err, res ) {
							spy.calledOnce().should.be.true;
						});
	})

	it( 'connection timeout with queue', function() {
		require('../lib/index');

		var handler = function() { var i = 1; };

		var spy = sinon.spy( handler );

		mockTimeout();

		 var request = superagent
						.get( '/me' )
						.timeout( 4 )
						.useQueue()
						.retryOnConnectionFailure( handler )
						.end( function( err, res ) {
							request.queueRequest.should.be.true;
							spy.calledOnce().should.be.true;
						});
	})

	it( 'send request with no queue, expect success',function() {
		require('../lib/index');

		mockSuccessGet();

		var request = superagent
						.get( '/me' )
						.end( function( err, res ) {

							var queueUsed = request.queueRequest === true;
							queueUsed.should.be.false;
							res.body.should.equal( SUCCESS_RESPONSE );
						});
	} )


	it( 'send request with no queue, expect failure',function() {
		require('../lib/index');

		mockFailedGet();

		var request = superagent
						.get( '/me' )
						.end( function( err, res ) {

							var queueUsed = request.queueRequest === true;
							queueUsed.should.be.false;
							res.body.should.equal( ERROR_RESPONSE );
						});
	} )

	it( 'send request with queue, expect success',function() {
		require('../lib/index');

		mockSuccessGet();

		var request = superagent
						.get( '/me' )
						.useQueue()
						.end( function( err, res ) {
							var queueUsed = request.queueRequest === true;
							queueUsed.should.be.true;
							res.body.should.equal( SUCCESS_RESPONSE );
						});
	} )

	it( 'send request with queue, expect failure',function() {
		require('../lib/index');

		mockFailedGet();

		var request = superagent
						.get( '/me' )
						.useQueue()
						.end( function( err, res ) {
							var queueUsed = request.queueRequest === true;
							queueUsed.should.be.true;
							res.body.should.equal( ERROR_RESPONSE );
						});
	} )

});