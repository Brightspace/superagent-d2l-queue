'use strict';

import SuperAgent from 'superagent';

function RequestQueue( superAgent ) {

	let Request = superAgent.Request;
	let superAgentEnd = Request.prototype.end;
	let queue = [];

	const TIMEOUT_REGEX = /timeout of \d+ms exceeded/;
	const CORS_REGEX = /Origin is not allowed by Access-Control-Allow-Origin/;

	const EXP_FACTOR = 1.4;
	const MAX_EXP_DROPOFF = 15;
	const MAX_INITIAL_TIMEOUT_REPEAT = 5;

	let initialRetryTimeout;
	let retryCount = 0;
	let repeatCount = 0;

	//HACK to Reset request to allow retry
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

		let headerKeys = Object.keys( headers );

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

	function _shouldAttempRetry( err, retryEnabled ) {

		if ( !retryEnabled || !err) {
			return false;
		}

		let gatewayOrServiceUnavailable =
				err.status && ( err.status === 502 || err.status === 503 || err.status === 504 );

		let requestTimedOut = TIMEOUT_REGEX.test( err ) || err.code ==='ECONNABORTED';

		if ( gatewayOrServiceUnavailable || requestTimedOut ) {
			initialRetryTimeout = 2000;
			return true;
		}

		let corsError = CORS_REGEX.test( err );

		if ( corsError ) {
			initialRetryTimeout = 5000;
			return true;
		}

		return false;
	}

	function _sendNextRequest() {

		let item = queue[0];

		if ( !item) {
			return;
		}

		_sendRequest( item.request, item.fn, item.timeout );
	}

	function _getTimeout( retryCount ) {
		return Math.round( initialRetryTimeout * Math.pow( 1.5, retryCount ) );
	}

	function _sendRequest( request, fn, timeout ) {

		superAgentEnd.call( request, ( err, res ) => {

			if ( _shouldAttempRetry( err, request.retryEnabled ) ) {

				_handleConnectionError( request.connectionErrorHandler, err );

				if ( repeatCount !== MAX_INITIAL_TIMEOUT_REPEAT ) {
					repeatCount = repeatCount = repeatCount + 1;
				}else if ( retryCount !== MAX_EXP_DROPOFF ) {
					retryCount = retryCount + 1;
				}

				let retryTimeout = _getTimeout( retryCount );

				setTimeout( function() {
					_resetRequest( request, timeout );
					_sendRequest( request, fn, request._timeout );
				}, retryTimeout );

				return;
			}

			repeatCount = 0;
			retryCount = 0;

			_returnResponse( fn, err, res );

			if ( request.queueRequest ) {
				queue.shift();
				_sendNextRequest();
			}
		});

	}

	Request.prototype.useQueue = function () {
		this.queueRequest = true;
		return this;
	};

	Request.prototype.retryOnConnectionFailure = function( connectionErrorHandler ) {
		this.retryEnabled = true;
		this.connectionErrorHandler = connectionErrorHandler;
		return this;
	};

	Request.prototype.end = function( fn ) {

		let self = this;
		let queueRequest = self.queueRequest;

		if ( queueRequest ) {

			queue.push(
				{
					request: self,
					fn: fn,
					timeout: self._timeout
				}
			);

			if ( queue.length === 1 ) {
				_sendNextRequest();
			}

			return;
		}

		_sendRequest( self, fn, self._timeout );
	};
}

export default RequestQueue( SuperAgent );