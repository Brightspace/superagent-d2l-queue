/*
 * Based on 'superagent-retry'
 * https://github.com/segmentio/superagent-retry/blob/master/lib/retries.js
 */

function econnreset( err, res ) {
	return err && err.code === 'ECONNRESET';
}

function etimedout( err, res ) {
	return err && err.code === 'ETIMEDOUT';
}

function eaddrinfo( err, res ) {
	return err && err.code === 'EADDRINFO';
}

function esockettimedout( err, res ) {
	return err && err.code === 'ESOCKETTIMEDOUT';
}

function internal( err, res ) {
	return res && res.status === 500;
}

function gateway( err, res ) {
	return res && [502, 503, 504].indexOf( res.status) !== -1;
}

function timeout( err, res ) {
	return err && /^timeout of \d+ms exceeded$/.test( err.message);
}

function cors( err, res ) {
	return err && /Origin is not allowed by Access-Control-Allow-Origin/.test( err.message);
}

const retryChecks = [
	econnreset,
	etimedout,
	eaddrinfo,
	esockettimedout,
	gateway,
	timeout,
	internal,
	cors
];

function should( err, res ) {
	return retryChecks.some( function ( check ) {
		return check(err, res);
	} );
}

module.exports = {
	should,
	retryChecks
};
