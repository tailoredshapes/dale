import { QuickPickleWorld, setWorldConstructor } from 'quickpickle';
import type { TestContext } from 'vitest';
import type Stripe from 'stripe';

export class DaleWorld extends QuickPickleWorld {
  tableName: string = 'dale-test-table';
  tenantId: string = 'tenant-1';
  botToken: string = 'bot-token';
  session: Partial<Stripe.Checkout.Session> | null = null;
  invoice: Partial<Stripe.Invoice> | null = null;
  subscription: Partial<Stripe.Subscription> | null = null;

  // Shared response state for all step definitions
  response: { statusCode: number; body: string } | null = null;

  constructor(context: TestContext, info: any) {
    super(context, info);
  }
}

setWorldConstructor(DaleWorld);
