import fs from 'fs/promises';
import { spawn, spawnSync, ChildProcess, SpawnSyncReturns } from 'child_process';
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

interface DockerComposeCommand {
  command: string;
  args: string[];
}

type SpawnSyncLike = (command: string, args: string[]) => Pick<SpawnSyncReturns<Buffer>, 'status' | 'stderr'>;

interface LiteLlmReadinessOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
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
  return [
    'DEMO_CLIENT_TOKEN',
    'LITELLM_BASE_URL',
    'LITELLM_API_KEY',
    'LITELLM_MODEL',
    'LITELLM_UPSTREAM_API_BASE',
    'LITELLM_UPSTREAM_API_KEY',
    'LITELLM_UPSTREAM_LITELLM_MODEL',
  ];
}

export function getDockerComposeCommand(hasDockerComposeSubcommand: () => boolean): DockerComposeCommand {
  return hasDockerComposeSubcommand()
    ? { command: 'docker', args: ['compose'] }
    : { command: 'docker-compose', args: [] };
}

function detectDockerComposeSubcommand(): boolean {
  const dockerHelp = process.env['OPENCODE_DOCKER_HELP'] ?? '';
  if (dockerHelp.length > 0) {
    return dockerHelp.includes('compose');
  }

  return false;
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

function createLiteLlmEnv(baseEnv: NodeJS.ProcessEnv, envVars: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    ...envVars,
    LITELLM_BASE_URL: stripTrailingSlash(envVars['LITELLM_BASE_URL']!),
    LITELLM_UPSTREAM_API_BASE: stripTrailingSlash(envVars['LITELLM_UPSTREAM_API_BASE']!),
  };
}

function spawnCommand(command: string, args: string[], childEnv?: NodeJS.ProcessEnv): ChildProcess {
  return spawn(command, args, {
    stdio: 'inherit',
    env: childEnv ?? process.env,
    shell: false,
  });
}

function createDockerComposeArgs(command: DockerComposeCommand, composeArgs: string[]): { command: string; args: string[] } {
  return {
    command: command.command,
    args: [...command.args, ...composeArgs],
  };
}

export async function assertDockerDaemonAvailable(
  runDockerInfo: SpawnSyncLike = (command, args) => spawnSync(command, args, { encoding: 'utf8' })
): Promise<void> {
  const result = runDockerInfo('docker', ['info']);

  if (result.status === 0) {
    return;
  }

  const stderr = String(result.stderr ?? '');
  if (stderr.includes('failed to connect to the docker API') || stderr.includes('Cannot connect to the Docker daemon')) {
    throw new Error('Docker daemon is not running. Start Docker Desktop or your Docker service, then rerun `yarn demo:full`.');
  }

  throw new Error(`Docker preflight failed: ${stderr.trim() || 'docker info exited unsuccessfully'}`);
}

export function getLiteLlmReadinessUrl(baseUrl: string): string {
  const normalizedBaseUrl = stripTrailingSlash(baseUrl);
  const origin = normalizedBaseUrl.endsWith('/v1') ? normalizedBaseUrl.slice(0, -3) : normalizedBaseUrl;
  return `${origin}/health/readiness`;
}

export async function waitForHealthyLiteLlm(
  baseUrl: string,
  apiKey: string,
  options: LiteLlmReadinessOptions = {}
): Promise<void> {
  const readinessUrl = getLiteLlmReadinessUrl(baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = options.maxAttempts ?? 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchImpl(readinessUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const body = (await response.json()) as { status?: string };
        if (body.status === 'healthy') {
          return;
        }
      }
    } catch {
      // Retry until timeout.
    }

    await sleep(1000);
  }

  throw new Error(`LiteLLM did not become ready at ${readinessUrl}`);
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

  const childEnv = createLiteLlmEnv(process.env, envVars);
  await assertDockerDaemonAvailable();
  const dockerComposeCommand = getDockerComposeCommand(detectDockerComposeSubcommand);
  const litellmUpCommand = createDockerComposeArgs(dockerComposeCommand, ['-f', 'docker-compose.litellm.yml', 'up', '-d']);
  const litellmUp = spawnCommand(litellmUpCommand.command, litellmUpCommand.args, childEnv);

  await new Promise<void>((resolve, reject) => {
    litellmUp.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`docker compose up failed with exit code ${code ?? 'unknown'}`));
    });
    litellmUp.once('error', reject);
  });

  await waitForHealthyLiteLlm(envVars['LITELLM_BASE_URL']!, envVars['LITELLM_API_KEY']!);

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

    const litellmDownCommand = createDockerComposeArgs(dockerComposeCommand, ['-f', 'docker-compose.litellm.yml', 'down']);
    const litellmDown = spawnCommand(litellmDownCommand.command, litellmDownCommand.args, childEnv);
    litellmDown.once('exit', () => process.exit(0));
    litellmDown.once('error', () => process.exit(1));
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
