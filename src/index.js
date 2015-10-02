'use strict';

module.exports = function( timeout, retry ) {
	var requestQueue = require( './RequestQueue' );
	return new requestQueue( timeout, retry );
};


