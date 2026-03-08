import { World, setWorldConstructor } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from 'playwright';

export interface CreatorConfig {
  baseUrl: string;
  apiUrl: string;
  cognitoDomain?: string;
  cognitoClientId?: string;
}

export class CreatorWorld extends World {
  public browser?: Browser;
  public context?: BrowserContext;
  public page?: Page;

  public config: CreatorConfig = {
    baseUrl: process.env.E2E_CREATOR_URL || 'http://localhost:5174',
    apiUrl: process.env.E2E_API_URL || 'http://localhost:3000',
    cognitoDomain: process.env.E2E_COGNITO_DOMAIN,
    cognitoClientId: process.env.E2E_COGNITO_CLIENT_ID,
  };

  public idToken?: string;
  public accessToken?: string;
  public tenantId?: string;
  public webhookSecret?: string;
  public roomId?: string;

  constructor(options: ConstructorParameters<typeof World>[0]) {
    super(options);
  }
}

setWorldConstructor(CreatorWorld);
