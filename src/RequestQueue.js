'use strict';

import SuperAgent from 'superagent';

function RequestQueue( superAgent ) {

	let Request = superAgent.Request;
	let superAgentEnd = Request.prototype.end;
	let queue = [];

	const TIMEOUT_REGEX = /timeout of \d+ms exceeded/;
	const CORS_REGEX = /Origin is not allowed by Access-Control-Allow-Origin/;

	let RETRY_TIMEOUT;

	//HACK to Reset request to allow retry
	function _resetRequest( request, timeout ) {

		let headers = request.req._headers;

		request.req.abort();
		request.called = false;
		request.timeout( timeout );

		delete request._timer;
		delete request._aborted;
		delete request.timedout;
		delete request.req;

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

		let requestTimedOut = TIMEOUT_REGEX.test( err );

		if ( gatewayOrServiceUnavailable || requestTimedOut ) {
			RETRY_TIMEOUT = 2000;
			return true;
		}

		let corsError = CORS_REGEX.test( err );

		if ( corsError ) {
			RETRY_TIMEOUT = 5000;
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

	function _sendRequest( request, fn, timeout ) {

		superAgentEnd.call( request, ( err, res ) => {

			if ( _shouldAttempRetry( err, request.retryEnabled ) ) {

				_handleConnectionError( request.connectionErrorHandler, err );

				setTimeout( function() {
					_resetRequest( request, timeout );
					_sendRequest( request, fn, request._timeout );
				}, RETRY_TIMEOUT );

				return;
			}

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