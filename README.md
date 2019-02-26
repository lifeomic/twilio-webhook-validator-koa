# twilio-webhook-validator-koa

[![npm](https://img.shields.io/npm/v/@lifeomic/twilio-webhook-validator-koa.svg)](https://www.npmjs.com/package/@lifeomic/twilio-webhook-validator-koa)
[![Build Status](https://travis-ci.org/lifeomic/twilio-webhook-validator-koa.svg?branch=master)](https://travis-ci.org/lifeomic/twilio-webhook-validator-koa)
[![Greenkeeper badge](https://badges.greenkeeper.io/lifeomic/twilio-webhook-validator-koa.svg)](https://greenkeeper.io/)

Koa middleware that provides Twilio request validation to Twilio webhooks.

# Example usage

```typescript
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as bodyParser from 'koa-bodyparser';
import { webhookValidator } from '@lifeomic/twilio-webhook-validator-koa';

const app = new Koa();
const router = new Router();

router.post(
  '/twilio',
  bodyParser(),
  webhookValidator({
    authToken: process.env.TWILIO_AUTH_TOKEN
  }),
  (ctx) => {
    ctx.body = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Twilio request validation succeeded!</Say>
</Response>`;
  }
);

app.use(router.routes()).listen(3000);
```
