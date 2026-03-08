interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
}

export async function getAccessToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`PayPal token request failed: ${response.status}`);
  }

  const data = await response.json() as PayPalTokenResponse;
  return data.access_token;
}

export async function registerPayPalWebhook(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  webhookUrl: string,
  eventTypes: string[],
): Promise<string> {
  // Skip actual registration in E2E/local mode
  if (process.env.SKIP_PAYPAL_REGISTRATION === 'true') {
    return `WH-mock-${Date.now()}`;
  }

  const accessToken = await getAccessToken(baseUrl, clientId, clientSecret);

  const response = await fetch(`${baseUrl}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      event_types: eventTypes.map(name => ({ name })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal webhook registration failed: ${response.status} ${text}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

export async function deletePayPalWebhook(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  webhookId: string,
): Promise<void> {
  const accessToken = await getAccessToken(baseUrl, clientId, clientSecret);

  const response = await fetch(`${baseUrl}/v1/notifications/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`PayPal webhook deletion failed: ${response.status}`);
  }
}
