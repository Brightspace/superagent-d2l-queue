#Request Queue 

[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Coverage Status](https://coveralls.io/repos/Brightspace/superagent-d2l-queue/badge.svg?branch=master&service=github)](https://coveralls.io/github/Brightspace/superagent-d2l-queue?branch=master)

Extends Superagent by adding the ability to queue up requests and retry failed requests due to timeouts.

## Installation

Install from NPM:

```shell
npm install superagent-d2l-queue
```

Uses the superagent library to perform ajax requests. Returns a deferred promises using the Q library.

## Usage

Added functions:

`useQueue()`

Every request that has this specified will be queued up. 

`retryOnConnectionFailure( handler )`

When a request fails due to a timeout or connection failure the request will be retried every 2 seconds until it can successfully send the request. A hanlder function can be specified in order to complete some action whenever a timeout occurs. This handler is optional.

```js
import Request from 'superagent';
import 'superagent-d2l-queue';

Request
	.get( '/me' )
	.useQueue()
	.retryOnConnectionFailure( function() {
		//do something
	})
	.end( function( err,res ) {
		//do something
	});
```


[npm-url]: https://npmjs.org/package/superagent-d2l-queue
[npm-image]: https://badge.fury.io/js/superagent-d2l-queue.png
[ci-url]: https://travis-ci.org/Brightspace/superagent-d2l-queue
[ci-image]: https://travis-ci.org/Brightspace/superagent-d2l-queue.svg

