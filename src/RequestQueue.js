'use strict'; 

import SuperAgent from 'superagent';

function RequestQueue( superAgent ) {
	
	let Request = superAgent.Request;
	let superAgentEnd = Request.prototype.end;

	let queue = [];

	//Reset request to allow retry
	function reset( obj, timeout ) {
		
		delete obj.xhr;
		delete obj._timer;
		delete obj.aborted;
		delete obj.timedout;
		delete obj.timeout;

		obj.timeout( timeout );
	}

	function handleConnError( connErrorHandler, err ) {
		
		if( connErrorHandler ) {
			connErrorHandler( err );
		}
	}

	function pop() {

		let item = queue[0];

		if ( !item) {
			return;
		}

		let obj = item.obj;
		let fn = item.fn;
		let connErrorHandler = item.connErrorHandler;
		let timeout = obj._timeout;

		superAgentEnd.call( obj, ( err, res ) => {

			if ( res ) {

				fn && fn( err, res );
				
				if( !err ) {
					
					queue.shift();
					pop();
				}
			} else {

				if( obj.shouldRetry ) {

					handleConnError( connErrorHandler, err );

				 	setTimeout( function() {
				 		reset( obj, timeout );
				 		pop();
				 	}, 2000 );

				}else {
					fn && fn( err, res );
				}

			}
		});
	}

	Request.prototype.useQueue = function () {
		this.queueRequest = true;
		return this;
	};

	Request.prototype.retryOnConnectionFailure = function( connErrorHandler ) {
		this.shouldRetry = true;
		this.connErrorHandler = connErrorHandler;
		return this;
	};

	Request.prototype.end = function (fn) {

		let self = this;
		let queueRequest = self.queueRequest;

		if ( queueRequest ) {
			queue.push(
				{ 
					obj: self,  
					fn: fn, 
					connErrorHandler: self.connErrorHandler
				}
			);

			if (queue.length === 1) {
				pop();
			}
		} else {
			superAgentEnd.call(this, function( err, res ) {

				if( !res && self.shouldRetry ) {

					handleConnError( self.connErrorHandler, err );

				 	setTimeout( function() {
				 		reset( self, self._timeout );
				 		self.end( fn );
				 	}, 2000 );
					
				}else {
					fn && fn( err, res );
				}
			});
		}
	};
}

export default RequestQueue( SuperAgent );