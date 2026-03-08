export interface AppConfig {
  apiUrl: string;
  cognitoDomain: string;
  cognitoClientId: string;
  redirectUri: string;
}

declare global {
  interface Window {
    DALE_CONFIG?: Partial<AppConfig>;
  }
}

const defaults: AppConfig = {
  apiUrl: 'http://localhost:3000',
  cognitoDomain: '',
  cognitoClientId: '',
  redirectUri: window.location.origin + '/auth',
};

export function getConfig(): AppConfig {
  return {
    ...defaults,
    ...window.DALE_CONFIG,
  };
}
