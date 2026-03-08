import type { TenantSecrets } from '../shared/types.js';
import { getAccessToken } from './client.js';

interface PayPalVerifyResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}

export async function verifyPayPalWebhook(
  baseUrl: string,
  headers: Record<string, string | undefined>,
  body: string,
  tenantSecrets: TenantSecrets,
): Promise<boolean> {
  // Skip verification in local/E2E mode
  if (process.env.SKIP_PAYPAL_SIGNATURE_VERIFY === 'true') {
    return true;
  }

  if (!tenantSecrets.paypalClientId || !tenantSecrets.paypalClientSecret || !tenantSecrets.paypalWebhookId) {
    return false;
  }

  const accessToken = await getAccessToken(baseUrl, tenantSecrets.paypalClientId, tenantSecrets.paypalClientSecret);

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: tenantSecrets.paypalWebhookId,
      webhook_event: JSON.parse(body),
    }),
  });

  if (!response.ok) {
    console.error(`PayPal webhook verification failed: ${response.status}`);
    return false;
  }

  const data = await response.json() as PayPalVerifyResponse;
  return data.verification_status === 'SUCCESS';
}
