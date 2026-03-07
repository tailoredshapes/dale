export interface EnvConfig {
  retainData: boolean;
  telegramTestMode?: boolean;
  blueGreenDeployment?: boolean;
}

export const environments: Record<string, EnvConfig> = {
  dev: { retainData: false, telegramTestMode: true },
  staging: { retainData: true },
  prod: { retainData: true, blueGreenDeployment: true },
};
