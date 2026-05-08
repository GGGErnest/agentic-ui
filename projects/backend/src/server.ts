/**
 * Backend server bootstrap with dotenv and config loading.
 */
import dotenv from 'dotenv';
import { createApp } from './create-app';
import { loadBackendConfig } from './config';

dotenv.config({ path: 'projects/backend/.env' });

const config = loadBackendConfig(process.env);
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`LiteLLM demo backend listening on :${config.port}`);
});
