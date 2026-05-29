import fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import process from 'process';
import dotenv from 'dotenv';

interface EnsureBackendEnvOptions {
  envPath: string;
  examplePath: string;
  fileExists?: (filePath: string) => Promise<boolean>;
  readFile?: (filePath: string) => Promise<string>;
  writeFile?: (filePath: string, content: string) => Promise<void>;
}

async function defaultFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getRequiredBootstrapVars(): string[] {
  return ['DEMO_CLIENT_TOKEN', 'LITELLM_BASE_URL', 'LITELLM_API_KEY', 'LITELLM_MODEL'];
}

export async function ensureBackendEnv({
  envPath,
  examplePath,
  fileExists = defaultFileExists,
  readFile = (filePath) => fs.readFile(filePath, 'utf8'),
  writeFile = (filePath, content) => fs.writeFile(filePath, content, 'utf8'),
}: EnsureBackendEnvOptions): Promise<boolean> {
  if (await fileExists(envPath)) {
    return false;
  }

  if (!(await fileExists(examplePath))) {
    throw new Error(`Missing backend env example at ${examplePath}`);
  }

  const content = await readFile(examplePath);
  await writeFile(envPath, content);
  return true;
}

function parseEnvFile(fileContent: string): Record<string, string> {
  return dotenv.parse(fileContent);
}

function validateRequiredVars(envVars: Record<string, string>): void {
  const missing = getRequiredBootstrapVars().filter((name) => !envVars[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in projects/backend/.env: ${missing.join(', ')}`);
  }
}

function spawnCommand(command: string, args: string[], childEnv?: NodeJS.ProcessEnv): ChildProcess {
  return spawn(command, args, {
    stdio: 'inherit',
    env: childEnv ?? process.env,
    shell: false,
  });
}

function forwardSignal(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.killed) {
    child.kill(signal);
  }
}

export async function runDemoFull(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '../../..');
  const envPath = path.join(repoRoot, 'projects/backend/.env');
  const examplePath = path.join(repoRoot, 'projects/backend/.env.example');

  const created = await ensureBackendEnv({ envPath, examplePath });
  if (created) {
    console.log('Created projects/backend/.env from projects/backend/.env.example');
  }

  const envFileContent = await fs.readFile(envPath, 'utf8');
  const envVars = parseEnvFile(envFileContent);
  validateRequiredVars(envVars);

  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...envVars };

  const backend = spawnCommand('npx', ['tsx', 'watch', 'projects/backend/src/server.ts'], childEnv);
  const demo = spawnCommand('npx', ['ng', 'serve'], childEnv);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    forwardSignal(backend, 'SIGTERM');
    forwardSignal(demo, 'SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  backend.once('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      shutdown();
    }
  });

  demo.once('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      shutdown();
    }
  });

  await Promise.race([
    new Promise((resolve) => backend.once('exit', resolve)),
    new Promise((resolve) => demo.once('exit', resolve)),
  ]);
}

if (require.main === module) {
  runDemoFull().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
