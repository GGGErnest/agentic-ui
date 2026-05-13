# LiteLLM Demo Backend Setup Guide

This guide walks through the complete local setup for running the demo with a real LiteLLM backend instead of the default mock provider.

## Prerequisites

- **Node.js/npm** with workspace access (root package.json manages all dependencies)
- **Docker & Docker Compose** for running LiteLLM locally
- **Ollama** installed locally or Docker-compatible for LLM model downloads (for the first run)

## Setup: Step by Step

Run these commands in order from the repo root:

### 1. Install dependencies
```bash
npm install
```

### 2. Create backend environment file
```bash
cp projects/backend/.env.example projects/backend/.env
```

### 3. Pull the Ollama model (one-time)
```bash
ollama pull llama3.2:3b
```

### 4. Start LiteLLM (terminal 1)
```bash
npm run litellm:up
```

LiteLLM starts in the background on `localhost:8000`.

### 5. Start the backend dev server (terminal 2)
```bash
npm run backend:dev
```

Backend listens on `localhost:3000`.

### 6. Start the demo app (terminal 3)
```bash
npm start
```

Demo runs on `localhost:4200`.

## Verification

Once all three services are running, verify connectivity:

### Health check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "litellmBaseUrl": "http://localhost:8000/v1",
  "litellmModel": "agentic-demo"
}
```

### LiteLLM models list
```bash
curl -H "Authorization: Bearer litellm-local-key" http://localhost:8000/v1/models
```

Expected: `200 OK` with a models list including `agentic-demo`.

### Backend proxy JSON request
```bash
curl http://localhost:3000/api/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer agentic-ui-demo" \
  -d '{
    "model": "ignored-by-backend",
    "stream": false,
    "messages": [{ "role": "user", "content": "Say hello in one sentence." }]
  }'
```

Expected: `200 OK` with a valid OpenAI-compatible chat response.

### Full workspace verification
```bash
npm run backend:test
ng build agentic-ui
ng test demo --watch=false
ng build demo --configuration development
```

All four commands should pass.

## Fallback Path and Local Development

**Default behavior:**
- **Development mode** (`ng serve` or `npm start`): demo connects to backend at `http://localhost:3000/api`
- **Production mode** (`ng build`): demo uses the inline mock provider

**If the backend is not running:**

Edit `projects/demo/src/environments/environment.development.ts` and change:
```typescript
llm: {
  mode: 'backend',  // <-- change to 'mock' to disable backend
  // ...
}
```

Then rebuild and restart the demo. This is a one-line local escape hatch if LiteLLM/Ollama are unavailable.

## Important: Workspace Source Resolution

The demo imports the `agentic-ui` library from its **workspace source** via the root
TypeScript path mapping — not from built output. Demo build and test see library
source changes immediately:

```
tsconfig.json:  "agentic-ui": ["./projects/agentic-ui/src/public-api.ts"]
```

Build the library only when you want to validate the published package output (`dist/agentic-ui`).
Stale dist files do NOT affect demo build/test flows.

## Stopping Services

### Stop backend
Press `Ctrl+C` in the terminal running `npm run backend:dev`.

### Stop LiteLLM
```bash
npm run litellm:down
```

### Stop demo
Press `Ctrl+C` in the terminal running `npm start`.

## Troubleshooting

**LiteLLM container fails to start:**
- Ensure Ollama is running on `localhost:11434` (or adjust `OLLAMA_API_BASE` in `projects/backend/.env`)
- Check logs: `npm run litellm:logs`

**Backend returns 401 Unauthorized:**
- Verify the `Authorization` header includes the exact token: `Bearer agentic-ui-demo`
- This token is configured in `projects/backend/.env` as `DEMO_CLIENT_TOKEN`

**Demo shows mock responses instead of backend responses:**
- Check that `projects/demo/src/environments/environment.development.ts` has `mode: 'backend'`
- Verify backend is running: `curl http://localhost:3000/health`
- Clear browser cache and hard-refresh

**Backend cannot reach LiteLLM:**
- Ensure LiteLLM container is running: `docker compose -f docker-compose.litellm.yml ps`
- Verify `LITELLM_BASE_URL` in `projects/backend/.env` matches the service endpoint

## Architecture Overview

The demo workflow consists of three independent services:

1. **LiteLLM** (`localhost:8000`) — OpenAI-compatible proxy
   - Loads model aliases from `litellm.config.yaml`
   - Authenticates with `LITELLM_API_KEY`
   - Proxies requests to OpenRouter, Ollama, or any configured provider

2. **Backend** (`localhost:3000`) — Express proxy and validator
   - Validates client tokens (`DEMO_CLIENT_TOKEN`)
   - Forwards `/api/chat/completions` requests to LiteLLM
   - Preserves streaming responses for real-time UI updates
   - Passes through the client's chosen model

3. **Demo App** (`localhost:4200`) — Angular 21 application
   - Uses MockLLMProvider for fast local development
   - Connect to the backend (via OpenAiProvider) for real LLM calls
   - Agent Shell shows thought streaming, step history, and telemetry

## Next Steps

Once verified, you can:
- Open the demo in your browser and test the Agent Shell
- Modify backend or LiteLLM config without restarting the demo (hot-reload in Node)
- Use the backend as a template for other LLM provider workflows (Claude, Cohere, etc.)
