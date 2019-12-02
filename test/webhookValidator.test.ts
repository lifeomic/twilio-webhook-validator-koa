import * as net from 'net';
import * as http from 'http';

import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as bodyParser from 'koa-bodyparser';
import * as request from 'superagent';

import {
  getExpectedTwilioSignature,
  getExpectedBodyHash
} from 'twilio/lib/webhooks/webhooks';

import {
  WebhookValidatorOptions,
  webhookValidator,
  TWILIO_SIGNATURE_HEADER_NAME
} from '../src/webhookValidator';

const getMockAuthToken = () => 'fd4da34b7439c3fe48b403546eb8d920';
const getMockRequestBody = (): [Record<string, string>, string] => {
  const payload = {
    Digits: '1234',
    To: '+18005551212',
    From: '+14158675309',
    Caller: '+14158675309',
    CallSid: 'CA1234567890ABCDE'
  };

  return [payload, getExpectedBodyHash(JSON.stringify(payload))];
};

const mockTwiMl = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say>Hello, World!</Say>
</Response>
`;

async function createTestService(
  options?: WebhookValidatorOptions
): Promise<http.Server & { url: string; host: string }> {
  const app = new Koa();
  const router = new Router();
  router.post(
    '/twilio',
    bodyParser(),
    webhookValidator(options),
    (ctx, next) => {
      ctx.response.body = mockTwiMl;
      return next();
    }
  );
  app.use(router.routes());

  const server = http.createServer(app.callback());
  const host = 'http://127.0.0.1';
  server.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as net.AddressInfo;
  const url = `${host}:${port}/twilio`;
  return Object.assign(server, {
    host: `host:${port}`,
    url
  });
}

test('successfully resolve response with valid Twilio request signature and bodySHA256', async () => {
  const authToken = getMockAuthToken();
  const server = await createTestService({ authToken });

  const [body, bodyHash] = getMockRequestBody();
  const url = `${server.url}?bodySHA256=${bodyHash}`;
  const expectedSignature = getExpectedTwilioSignature(authToken, url, body);

  await request
    .post(url)
    .set(TWILIO_SIGNATURE_HEADER_NAME, expectedSignature)
    .send(body)
    .then(({ status, text }) => {
      expect(status).toEqual(200);
      expect(text).toBe(mockTwiMl);
    });
  server.close();
});

test('throws error when Twilio authToken not provided', async () => {
  const server = await createTestService({});
  await expect(request.post(server.url).send({})).rejects.toThrow(
    'Internal Server Error'
  );

  server.close();
});

test('successfully resolves response with valid Twilio request signature', async () => {
  const authToken = getMockAuthToken();
  const server = await createTestService({ authToken });

  const [body] = getMockRequestBody();
  const expectedSignature = getExpectedTwilioSignature(
    authToken,
    server.url,
    body
  );

  await request
    .post(server.url)
    .set(TWILIO_SIGNATURE_HEADER_NAME, expectedSignature)
    .send(body)
    .then(({ status, text }) => {
      expect(status).toEqual(200);
      expect(text).toBe(mockTwiMl);
    });
  server.close();
});

test('uses custom host to validate Twilio signature', async () => {
  const host = 'api.acme.io';
  const authToken = getMockAuthToken();
  const server = await createTestService({ authToken, host });

  const expectedSignature = getExpectedTwilioSignature(
    authToken,
    `http://${host}/twilio`,
    {}
  );

  await request
    .post(server.url)
    .set(TWILIO_SIGNATURE_HEADER_NAME, expectedSignature)
    .send()
    .then(({ status }) => expect(status).toEqual(200));
  server.close();
});

test('uses env variables to resolve Twilio authToken', async () => {
  process.env.TWILIO_AUTH_TOKEN = getMockAuthToken();
  const server = await createTestService();

  const expectedSignature = getExpectedTwilioSignature(
    process.env.TWILIO_AUTH_TOKEN,
    server.url,
    {}
  );

  await request
    .post(server.url)
    .set(TWILIO_SIGNATURE_HEADER_NAME, expectedSignature)
    .send()
    .then(({ status }) => expect(status).toEqual(200));

  delete process.env.TWILIO_AUTH_TOKEN;
  server.close();
});

test('throws error with invalid Twilio request signature', async () => {
  const authToken = getMockAuthToken();
  const server = await createTestService({ authToken });
  const [body] = getMockRequestBody();
  await expect(
    request
      .post(server.url)
      .set(TWILIO_SIGNATURE_HEADER_NAME, 'bogus')
      .send(body)
  ).rejects.toThrowError('Forbidden');

  server.close();
});

test('throws error with Twilio request without signature', async () => {
  const authToken = getMockAuthToken();
  const server = await createTestService({ authToken });
  const [body] = getMockRequestBody();
  await expect(request.post(server.url).send(body)).rejects.toThrowError(
    'Bad Request'
  );

  server.close();
});

test('throws error with invalid bodySHA256', async () => {
  const authToken = getMockAuthToken();
  const server = await createTestService({ authToken });

  const [body] = getMockRequestBody();
  const url = `${server.url}?bodySHA256=bogus`;
  const expectedSignature = getExpectedTwilioSignature(url, authToken, body);

  await expect(
    request
      .post(url)
      .set(TWILIO_SIGNATURE_HEADER_NAME, expectedSignature)
      .send(body)
  ).rejects.toThrowError('Forbidden');
  server.close();
});
