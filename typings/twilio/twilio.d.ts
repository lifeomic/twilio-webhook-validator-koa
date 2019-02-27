declare module 'twilio/lib/webhooks/webhooks' {
  export function validateRequest(
    authToken: string,
    twilioHeader: string,
    url: string,
    params: Record<string, any>
  ): boolean;

  export function validateRequestWithBody(
    authToken: string,
    twilioHeader: string,
    url: string,
    body: string
  ): boolean;
}
