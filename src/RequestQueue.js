'use strict';

const retry = require( './Retry' );

function requestQueue( params ) {

	const superagentEnd = this.end;
	const options = Object.assign( {
		queue: undefined, // Array
		initialTimeout: 2000,
		backoff: {
			exp: {
				factor: 1.4
			},
			retries: 5,
			override: _computeWaitPeriod
		}
	}, params );

	this.queue = options.queue;

	let retryCount = 0;

	function _computeWaitPeriod( retryCount ) {
		return Math.round( options.initialTimeout *
			Math.pow( options.backoff.exp.factor, retryCount ) );
	}

	function _resetRequest( request, timeout ) {

		let headers = {};

		if ( request.req ) {
			headers = request.req._headers;
			request.req.abort();
		}

		request.called = false;
		request.timeout( timeout );

		delete request._timer;
		delete request.timer;
		delete request.aborted;
		delete request._aborted;
		delete request.timedout;
		delete request.req;
		delete request.xhr;

		const headerKeys = Object.keys( headers );
		for( let i = 0; i < headerKeys.length; i++ ) {
			request.set( headerKeys[i], headers[headerKeys[i]] );
		}
	}

	function _returnResponse( fn, err, res ) {
		if ( fn ) {
			fn( err, res );
		}
	}

	function _handleConnectionError( connectionErrorHandler, err ) {
		if ( connectionErrorHandler ) {
			connectionErrorHandler( err );
		}
	}

	function _sendNextRequest() {

		const item = this.queue[0];
		if ( item ) {
			_sendRequest( item.request, item.fn, item.timeout );
		}

	}

	function _sendRequest( request, fn, timeout ) {

		superagentEnd.call( request, ( err, res ) => {

			if ( request.retryEnabled && retry.should( err, res ) ) {

				_handleConnectionError( request.connectionErrorHandler, err );

				if ( retryCount !== options.backoff.retries ) {
					retryCount = retryCount + 1;
				}

				let retryWaitPeriod = options.backoff.override( retryCount );

				setTimeout( function() {
					_resetRequest( request, timeout );
					_sendRequest( request, fn, request._timeout );
				}, retryWaitPeriod );
			} else {
				retryCount = 0;

				_returnResponse( fn, err, res );

				if ( request.queue ) {
					request.queue.shift();
					_sendNextRequest.call( request );
				}
			}

		});

	}

	this.retryOnConnectionFailure = function( connectionErrorHandler ) {
		this.retryEnabled = true;
		this.connectionErrorHandler = connectionErrorHandler;
		return this;
	};

	this.end = function( fn ) {

		if ( this.queue ) {

			this.queue.push(
				{
					request: this,
					fn: fn,
					timeout: this._timeout
				}
			);

			if ( this.queue.length === 1 ) {
				_sendNextRequest.call(this);
			}
		} else {
			_sendRequest( this, fn, this._timeout );
		}

	};

	return this;
}

function create(params) {
	return function(request) {
		return requestQueue.call(request, params);
	};
};

create.makeQueue = function() {
	return [];
};

module.exports = create;
