import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppConfig } from '../shared/types';
import { defaultConfigForPlatform, mergeConfig } from '../shared/config';

export interface LoadedConfig {
  config: AppConfig;
  configPath: string;
  migrationSourcePath?: string;
}

export function getLegacyConfigCandidates(userDataPath: string): string[] {
  const appDataDir = path.dirname(userDataPath);
  return [
    path.join(appDataDir, 'voicepaste-v0.4', 'config.json'),
    path.join(appDataDir, 'VoicePaste v0.4', 'config.json'),
  ];
}

export function migrateLegacyConfigIfNeeded(configPath: string, userDataPath: string): string | undefined {
  if (fs.existsSync(configPath)) {
    return undefined;
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  for (const legacyPath of getLegacyConfigCandidates(userDataPath)) {
    if (!fs.existsSync(legacyPath)) {
      continue;
    }
    try {
      fs.copyFileSync(legacyPath, configPath);
      return legacyPath;
    } catch {
      // Ignore copy failures and keep trying other candidates.
    }
  }

  return undefined;
}

export function loadConfig(): LoadedConfig {
  const userData = app.getPath('userData');
  const configPath = path.join(userData, 'config.json');
  const migrationSourcePath = migrateLegacyConfigIfNeeded(configPath, userData);

  let parsed: Partial<AppConfig> | null = null;
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      parsed = JSON.parse(raw) as Partial<AppConfig>;
    } catch {
      parsed = null;
    }
  }

  const config = mergeConfig(parsed, process.platform);

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  return { config, configPath, migrationSourcePath };
}

export function saveConfig(configPath: string, config: AppConfig): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function defaultConfig(): AppConfig {
  return defaultConfigForPlatform(process.platform);
}
