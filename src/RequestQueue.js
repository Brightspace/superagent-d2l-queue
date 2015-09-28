'use strict';

import Q from 'q';
import Request from 'superagent';
import Auth from 'superagent-d2l-session-auth';

/**
* Request helper that will send request directly or using a queue depending on the params provided
* send( request ) takes in a request object with the following params:
* @param {String} url
* @param {String} method
* @param {Object} payload (OPTIONAL)
* @param {Boolean} useQueue (OPTIONAL: If set then requests will queued )
*/

const RETRY_INTERVAL = 2000;
const REQUEST_TIMEOUT = 15000;

class RequestUtils extends {

	_bind( ...handlers ) {
		handlers.forEach( handler => this[handler] = this[handler].bind( this ) );
	}

	constructor() {

		this.queue = [];

		this._bind( 'send', '_handleResponse', '_handleResponseWithQueue', '_retry', '_sendRequest' );
	}
	
	_sendRequest( queueItem ) {
		
		let self = this;

		Request( queueItem.request.method, queueItem.request.url )
			.use( Auth )
			.send( queueItem.request.payload ? queueItem.request.payload : null )
			.timeout( REQUEST_TIMEOUT )
			.end( ( error, response ) => { 

				if( response && !error ) {

					if( queueItem.request.useQueue ) {
						self._handleResponseWithQueue( queueItem, response );
					}else {
						self._handleResponse( queueItem, response );
					}

					return;
				}

				// Server error( 400, 404, 500, etc ) detected
				if( error && response ) {

					queueItem.deferred.reject( error );

					return;
				}

				// If a timeout happens during a request, invoke .notify() so that .progress() will catch
				// the notification, causing the application to notify the user that there is a connection
				// problem. The request will automatically be retried every RETRY_INTERVAL seconds.
				queueItem.deferred.notify( error );

				this._retry( queueItem );
			});
	}


	_handleResponse( queueItem, response ) {
		queueItem.deferred.resolve( response.body );
	}

	_handleResponseWithQueue( queueItem, response ) {

		this.queue.shift();	

		this._handleResponse( queueItem, response );

		if( this.queue.length > 0 ) {
			this._sendRequest( this.queue[0] );
		}
	}

	_retry(	queueItem ) {

		setTimeout( () => { this._sendRequest( queueItem ); }, RETRY_INTERVAL );
	}

	send( request ) {

		let deferred = Q.defer();

		if( request.useQueue ) {

			this.queue.push( 
				{ 
					deferred: deferred,
					request: request 
				} 
			);
			
			if( this.queue.length === 1 ) {
				this._sendRequest( this.queue[0] );
			}
		}else {
			this._sendRequest( 
				{ 
					deferred: deferred,
					request: request 
				} 
			);
		}

		return deferred.promise;
	}
}

let _requestUtils = new RequestUtils();

export default _requestUtils;