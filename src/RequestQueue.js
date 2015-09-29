'use strict';

import Q from 'q';
import Request from 'superagent';

/**
* Request helper that will send request directly or using a queue depending on the params provided
* send( request ) takes in a request object with the following params:
* @param {String} url
* @param {String} method
* @param {Object} auth ( OPTIONAL )
* @param {Object} payload (OPTIONAL)
* @param {Boolean} useQueue (OPTIONAL: If set then requests will queued )
*/

const RETRY_INTERVAL = 2000;
const REQUEST_TIMEOUT = 15000;

class RequestQueue {

	_bind( ...handlers ) {
		handlers.forEach( handler => this[handler] = this[handler].bind( this ) );
	}

	constructor() {

		this.queue = [];

		this._bind( 'send', '_handleResponse', '_handleResponseWithQueue', '_retry', '_sendRequest' );
	}

	_sendRequest( request ) {

		let _handleResponse = this._handleResponse;

		let _request = Request( request.method, request.url )
							.timeout( REQUEST_TIMEOUT );

		if( request.payload ) {
			_request
				.send( request.payload );
		}

		if( request.auth ) {
			_request
				.use( request.auth );
		}

		if( request.useQueue ) {
			_handleResponse = this._handleResponseWithQueue;
		}

		_request
			.end( ( error, response ) => { 
				if( response && !error ) {

					_handleResponse( request, response );

					return;
				}

				// Server error( 400, 404, 500, etc ) detected
				if( error && response ) {

					request.deferred.reject( error );

					return;
				}

				// If a timeout happens during a request, invoke .notify() so that .progress() will catch
				// the notification, causing the application to notify the user that there is a connection
				// problem. The request will automatically be retried every RETRY_INTERVAL seconds.
				request.deferred.notify( error );

				this._retry( request );
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

	_createRequestObject( request, deferred ) {
		return {
			deferred: deferred,
			url: request.url,
			method: request.method,
			payload: request.payload,
			auth: request.auth,
			useQueue: request.useQueue
		};
	}

	send( request ) {

		let deferred = Q.defer();

		if( request.useQueue ) {

			this.queue.push( this._createRequestObject( request, deferred ) );
			
			if( this.queue.length === 1 ) {
				this._sendRequest( this.queue[0] );
			}
		}else {
			this._sendRequest( this._createRequestObject( request, deferred ) );
		}

		return deferred.promise;
	}
}

let _requestQueue = new RequestQueue();

export default _requestQueue;