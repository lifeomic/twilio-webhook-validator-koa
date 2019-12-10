import * as url from 'url';

import { Middleware } from 'koa';
import {
  validateRequest,
  validateRequestWithBody
} from 'twilio/lib/webhooks/webhooks';

export const TWILIO_SIGNATURE_HEADER_NAME = 'X-Twilio-Signature';
export const ERR_INVALID_REQUEST = 'Twilio Request Validation Failed.';
export const ERR_TOKEN_REQUIRED =
  'Webhook Error - we attempted to validate this request without first configuring our auth token.';
export const ERR_SIGNATURE_REQUIRED =
  'No signature header error - X-Twilio-Signature header does not exist, maybe this request is not coming from Twilio.';

export interface WebhookValidatorOptions {
  host?: string;
  protocol?: string;
  authToken?: string;
}

export function webhookValidator({
  authToken = process.env.TWILIO_AUTH_TOKEN,
  protocol,
  host
}: WebhookValidatorOptions = {}): Middleware {
  return async function hook(context, next) {
    if (!authToken) {
      return context.throw(500, ERR_TOKEN_REQUIRED);
    }

    const signature = context.get(TWILIO_SIGNATURE_HEADER_NAME);

    if (!signature) {
      return context.throw(400, ERR_SIGNATURE_REQUIRED);
    }

    const rawOriginalUrl = url.format({
      protocol: protocol || context.protocol,
      host: host || context.host,
      pathname: context.originalUrl
    });

    const originalUrl =
      context.originalUrl.search(/\?/) >= 0
        ? rawOriginalUrl.replace('%3F', '?')
        : rawOriginalUrl;

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
