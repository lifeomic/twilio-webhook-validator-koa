import * as url from 'url';
import * as crypto from 'crypto';

import { Middleware, Context } from 'koa';
import {
  validateRequest,
  validateRequestWithBody
} from 'twilio/lib/webhooks/webhooks';

export const TWILIO_SIGNATURE_HEADER_NAME = 'X-Twilio-Signature';
export const ERR_INVALID_REQUEST = 'Twilio request validation failed.';
export const ERR_TOKEN_REQUIRED =
  'Twilio authToken is required for request validation.';

export function getHmacSha1Base64Digest(
  symmetricKey: string,
  data: Buffer
): string {
  return crypto
    .createHmac('sha1', symmetricKey)
    .update(data)
    .digest('base64');
}

export function getSha256HexDigest(data: Buffer): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

function getUrlFromContext(context: Context): string {
  return url.format({
    protocol: context.protocol,
    host: context.host,
    pathname: context.originalUrl
  });
}

export function getExpectedTwilioSignature({
  authToken,
  body,
  originalUrl
}: {
  authToken: string;
  originalUrl: string;
  body: Record<string, any>;
}) {
  if (originalUrl.includes('bodySHA256')) body = {};
  const data = Object.entries(body)
    .sort()
    .reduce((acc, [key, value]) => acc + key + value, originalUrl);
  return getHmacSha1Base64Digest(authToken, Buffer.from(data));
}

export interface WebhookValidatorOptions {
  authToken?: string;
}

export function webhookValidator({
  authToken = process.env.TWILIO_AUTH_TOKEN
}: WebhookValidatorOptions = {}): Middleware {
  return async function hook(context, next) {
    if (!authToken) {
      return context.throw(500, ERR_TOKEN_REQUIRED);
    }

    const rawOriginalUrl = getUrlFromContext(context);
    const originalUrl =
      context.originalUrl.search(/\?/) >= 0
        ? rawOriginalUrl.replace('%3F', '?')
        : rawOriginalUrl;
    const signature = context.get(TWILIO_SIGNATURE_HEADER_NAME);
    const { body } = context.request;
    const rawBody = JSON.stringify(body);
    const hasBodyHash = originalUrl.includes('bodySHA256');

    const valid = hasBodyHash
      ? validateRequestWithBody(authToken, signature, originalUrl, rawBody)
      : validateRequest(authToken, signature, originalUrl, body);

    if (!valid) {
      return context.throw(403, new Error(ERR_INVALID_REQUEST));
    }
    await next();
  };
}
