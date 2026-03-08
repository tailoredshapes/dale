import { World, setWorldConstructor } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from 'playwright';

export interface AdminConfig {
  baseUrl: string;
  apiUrl: string;
  cognitoDomain?: string;
  cognitoClientId?: string;
}

export class AdminWorld extends World {
  public browser?: Browser;
  public context?: BrowserContext;
  public page?: Page;

  public config: AdminConfig = {
    baseUrl: process.env.E2E_ADMIN_URL || 'http://localhost:5175',
    apiUrl: process.env.E2E_API_URL || 'http://localhost:3000',
    cognitoDomain: process.env.E2E_COGNITO_DOMAIN,
    cognitoClientId: process.env.E2E_COGNITO_CLIENT_ID,
  };

  public idToken?: string;
  public accessToken?: string;
  public tenantId?: string;

  constructor(options: ConstructorParameters<typeof World>[0]) {
    super(options);
  }
}

setWorldConstructor(AdminWorld);
