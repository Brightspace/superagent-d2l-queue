#Request queue using superagent and Q promise library

[![Build status][ci-image]][ci-url]


## Usage

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

**payload**, **useQueue**, **auth** are optional.

```js
Request.send(
	{
		url: someUrl,
		method: 'GET'
	}
);
```
[ci-url]: https://travis-ci.org/Brightspace/superagent-d2l-promise-queue
[ci-image]: https://travis-ci.org/Brightspace/superagent-d2l-promise-queue.svg
