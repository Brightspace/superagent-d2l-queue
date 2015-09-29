[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Coverage Status][coverage-image]][coverage-url]

#Request Queue 

Uses the superagent library to perform ajax requests. Returns a deferred promises using the Q library.

[![Build status][ci-image]][ci-url]


## Usage

`send( Object )`

The send function returns a deferred promise which can be resolved or rejected. The promise will be rejected if the request returns a error code such as 400, 404, 500, etc. The queue will attempt to retry the requst every 2 seconds if the request did not recieve a response from the endpoint provided. Before a retry the deferred object will send a `.notify` which can be subscribed to using `.progress` on the client side to preform any action prior to retry such as notifying the user that a connection loss occured.

```js
import Request from 'superagent-d2l-promise-queue';

Request.send( 
	{
		url: someUrl,
		method: 'POST',
		payload: { text: 'Creating some entity' },
		useQueue: true,
		auth: sessionAuth
	}
);
```

**payload**, **useQueue** and **auth** are optional parameters.

```js
Request.send(
	{
		url: someUrl,
		method: 'GET'
	}
);
```
[npm-url]: https://npmjs.org/package/superagent-d2l-promise-queue
[npm-image]: https://badge.fury.io/js/superagent-d2l-promise-queue.png
[ci-url]: https://travis-ci.org/Brightspace/superagent-d2l-promise-queue
[ci-image]: https://travis-ci.org/Brightspace/superagent-d2l-promise-queue.svg
[coverage-image]: https://img.shields.io/coveralls/Brightspace/superagent-d2l-promise-queue.svg
[coverage-url]: https://coveralls.io/r/Brightspace/superagent-d2l-promise-queue?branch=master