# LiteLLM Demo Backend Setup Guide

This guide walks through the complete local setup for running the demo with a real LiteLLM backend instead of the default mock provider.

## Prerequisites

- **Node.js** with workspace access
- **Docker & Docker Compose** for running LiteLLM locally
- **OpenCode Go API key** with access to `deepseek-v4-pro`

## Setup: Step by Step

Run these commands from the repo root.

### 1. Install dependencies
```bash
yarn install
```

### 2. Create backend environment file
```bash
cp projects/backend/.env.example projects/backend/.env
```

### 3. Put your OpenCode Go key in `projects/backend/.env`
Set:

```env
LITELLM_UPSTREAM_API_KEY=your-real-opencode-go-key
```

Default upstream values already target OpenCode Go and `deepseek-v4-pro`:

```env
LITELLM_UPSTREAM_API_BASE=https://opencode.ai/zen/go/v1
LITELLM_UPSTREAM_LITELLM_MODEL=openai/deepseek-v4-pro
```

### 4. Start the full stack
```bash
yarn demo:full
```

This command will:

- create `projects/backend/.env` from `.env.example` if it does not exist yet
- start LiteLLM on `localhost:8000`
- start the backend on `localhost:3000`
- start the Angular demo on `localhost:4200`

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
yarn backend:test
ng build agentic-ui
ng test demo --watch=false
ng build demo --configuration development
```

All four commands should pass.

## Fallback Path and Local Development

**Default behavior:**
- **Development mode** (`ng serve`, `yarn start`, or `yarn demo:full`): demo connects to backend at `http://localhost:3000/api`
- **Production mode** (`ng build`): demo uses the inline mock provider

**If the backend is not running:**

Edit `projects/demo/src/environments/environment.development.ts` and change:
```typescript
llm: {
  mode: 'backend',  // <-- change to 'mock' to disable backend
  // ...
}
```

Then rebuild and restart the demo. This is a one-line local escape hatch if LiteLLM is unavailable.

## Stopping Services

Press `Ctrl+C` in the terminal running `yarn demo:full`. The command shuts down backend, demo, and LiteLLM.

## Troubleshooting

**LiteLLM container fails to start:**
- Check logs: `yarn litellm:logs`
- Verify `LITELLM_UPSTREAM_API_BASE` and `LITELLM_UPSTREAM_API_KEY` in `projects/backend/.env`

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
- Verify `LITELLM_UPSTREAM_API_BASE=https://opencode.ai/zen/go/v1`
- Verify `LITELLM_UPSTREAM_LITELLM_MODEL=openai/deepseek-v4-pro`

## Architecture Overview

The demo workflow consists of three independent services:

1. **LiteLLM** (`localhost:8000`) — OpenAI-compatible proxy to OpenCode Go
   - Loads model aliases from `litellm.config.yaml`
   - Authenticates with `LITELLM_API_KEY`
   - Proxies requests to `https://opencode.ai/zen/go/v1`
   - Routes `agentic-demo` to `openai/deepseek-v4-pro` by default

2. **Backend** (`localhost:3000`) — Express proxy and validator
   - Validates client tokens (`DEMO_CLIENT_TOKEN`)
   - Forwards `/api/chat/completions` requests to LiteLLM
   - Preserves streaming responses for real-time UI updates
   - Enforces the LiteLLM model alias (`LITELLM_MODEL`)

3. **Demo App** (`localhost:4200`) — Angular 21 application
   - Selects `OpenAiProvider` in development (backend mode)
   - Falls back to `MockLLMProvider` if configured
   - Uses the backend at `http://localhost:3000/api`
   - Sends `Authorization: Bearer agentic-ui-demo` header

## Next Steps

Once verified, you can:
- Open the demo in your browser and test the Agent Shell
- Modify backend or LiteLLM config without restarting the demo (hot-reload in Node)
- Use the backend as a template for other OpenAI-compatible or LiteLLM-backed providers
