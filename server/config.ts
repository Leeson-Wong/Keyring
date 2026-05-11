import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export interface Config {
  port: number;
  dataPath: string;
}

export async function loadConfig(): Promise<Config> {
  // Env vars override config file
  const port = Number(process.env.PORT) || 0;
  const dataPath = process.env.DATA_PATH || '';

  // Try config file for defaults
  let filePort = 5179;
  let fileDataPath = './data';

  for (const p of ['config.json', 'config.local.json']) {
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(await readFile(p, 'utf-8'));
        if (raw.port) filePort = raw.port;
        if (raw.dataPath) fileDataPath = raw.dataPath;
        break;
      } catch {}
    }
  }

  return {
    port: port || filePort,
    dataPath: dataPath || fileDataPath,
  };
}
