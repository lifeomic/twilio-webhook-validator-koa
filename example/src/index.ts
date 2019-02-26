import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as bodyParser from 'koa-bodyparser';

import { webhookValidator } from '../../src';

const { PORT = '3000', TWILIO_AUTH_TOKEN } = process.env;

if (!TWILIO_AUTH_TOKEN) {
  console.error('TWILIO_AUTH_TOKEN env var is required');
  process.exit(1);
}

const app = new Koa();
const router = new Router();

router.post('/twilio', bodyParser(), webhookValidator(), (ctx, next) => {
  ctx.response.body = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
      <Say>Hello, World!</Say>
  </Response>`;
  next();
});

app.use(router.routes()).listen(parseInt(PORT, 10), () => {
  console.info(`Server running on http://127.0.0.1:${PORT}...`);
  console.info(`Run 'ngrok http ${PORT}' to test with Twilio.\n`);
});
