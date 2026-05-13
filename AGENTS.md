# AGENTS.md

Guidance for agents working in the `agentic-ui` Angular CLI monorepo.

## Scope And Tech Stack

**Project type:** Angular CLI (not Nx) with three projects: a library `agentic-ui`, a demo app, and an Express backend.

- **Package manager:** npm (lockfile: `package-lock.json`)
- **Angular version:** ^21.2.0 / TypeScript ~5.9.2 / Vitest ^4.0.8
- **Library builder:** ng-packagr with entrypoint at `projects/agentic-ui/src/public-api.ts`
- **Library output:** `dist/agentic-ui`
- **Demo app:** Angular CLI application at `projects/demo`
- **Backend:** Express server at `projects/backend` — LiteLLM proxy for real LLM calls
- **Root tsconfig import path:** `"agentic-ui": ["./projects/agentic-ui/src/public-api.ts"]`

## Architecture

```
npm start (Angular :4200)
  │  Uses MockLLMProvider for local UI development
  │
  └── For real LLM calls:
        │  POST http://localhost:3000/api/chat/completions
        │  Authorization: Bearer agentic-ui-demo
        ▼
      npm run backend:dev (Express :3000)
        │  Forwards to LiteLLM with LITELLM_API_KEY
        ▼
      npm run litellm:up (LiteLLM :8000)
        │  Routes to configured model (OpenRouter / Ollama / etc.)
        ▼
      OpenRouter / Ollama / any OpenAI-compatible provider
```

**The demo uses MockLLMProvider for fast local iteration.** Real LLM calls go through the backend → LiteLLM pipeline. The OpenAiProvider class is available in the library for consumers who want a direct OpenAI-compatible client.

## Critical Architecture Notes

**The demo app resolves the library from workspace source, not built dist output.**

The demo imports `agentic-ui` through the root TypeScript path mapping, which points at `projects/agentic-ui/src/public-api.ts`. Demo build and test therefore see library source changes immediately without requiring a library rebuild first.

Build the library when you specifically want to validate the published/package output:

```bash
ng build agentic-ui
```

This still outputs to `dist/agentic-ui`, but stale dist files no longer affect normal demo build/test flows.

## Commands

### Install Dependencies
```bash
npm install
```

### Start Demo App (Development)
```bash
npm start
```

Default serves the `demo` project (the application target) on localhost:4200.

Alternatives:
```bash
ng serve demo                           # explicit
ng serve demo --configuration development
```

### Start Backend + LiteLLM (for real LLM calls)
```bash
npm run litellm:up      # start LiteLLM proxy (Docker)
npm run backend:dev     # start Express backend
```

### Build Library
```bash
ng build agentic-ui
```

Outputs to `dist/agentic-ui`.

### Build Demo (Development)
```bash
ng build demo --configuration development
```

### Test Library
```bash
ng test agentic-ui --watch=false
```

Uses Vitest with jsdom. Spec tsconfigs include `vitest/globals`.

### Test Demo
```bash
ng test demo --watch=false
```

### Test Backend
```bash
npm run backend:test
```

### Full CI Verification
```bash
ng build agentic-ui && ng test agentic-ui --watch=false && ng test demo --watch=false && npm run backend:test && ng build demo --configuration development
```

## Code Style

**Prettier:** `printWidth: 100`, `singleQuote: true`, Angular HTML parser for `*.html` files.

Format with Prettier before committing. No linting commands are configured.

## Project Structure

```
agentic-ui/
├── projects/
│   ├── agentic-ui/              # Library
│   │   ├── src/
│   │   │   ├── public-api.ts    # Entry point
│   │   │   └── lib/             # Library source
│   │   ├── ng-package.json      # ng-packagr config
│   │   └── tsconfig.lib*.json   # Library tsconfigs
│   ├── demo/                     # Demo app
│   │   ├── src/
│   │   │   ├── main.ts          # Bootstrap
│   │   │   ├── app/
│   │   │   └── styles.scss
│   │   ├── proxy.conf.mjs       # Optional: direct OpenRouter proxy (alternative to backend)
│   │   └── tsconfig.app.json
│   └── backend/                  # Express backend
│       ├── src/
│       │   ├── server.ts        # Bootstrap (dotenv + config)
│       │   ├── create-app.ts    # Express app factory
│       │   ├── config.ts        # Config loader + validation
│       │   └── routes/          # API routes
│       └── .env                 # Backend secrets (gitignored)
├── dist/agentic-ui/             # Library build output
├── litellm.config.yaml          # LiteLLM model routing config
├── docker-compose.litellm.yml   # LiteLLM Docker setup
├── angular.json
├── tsconfig.json                # Root (includes import path mapping)
└── package.json
```

## Common Gotchas

1. **Demo uses workspace library source.** You can validate demo changes against `projects/agentic-ui/src/` directly. Run `ng build agentic-ui` only when validating package output in `dist/agentic-ui`.

2. **Strict TypeScript by default.** Root tsconfig uses `"strict": true` with `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, and `noImplicitReturns`.

3. **No lint command.** The repo has no configured linter. Rely on Prettier for formatting and TypeScript compiler errors.

4. **Vitest globals.** Test specs include `vitest/globals`, so `describe`, `it`, `expect` are available without imports.

5. **Demo uses MockLLMProvider locally.** The agent shell shows simulated thoughts/actions. For real LLM calls, start the backend + LiteLLM services.

## Conventions

- **Component prefix for library:** `agui-` (configured in `angular.json`)
- **Component prefix for demo:** `app-` (configured in `angular.json`)
- **SCSS:** Demo uses SCSS by default (see `projects/demo/schematics` in `angular.json`)

## Useful Paths

- Library source: `projects/agentic-ui/src/lib/`
- Library tests: `projects/agentic-ui/src/lib/**/*.spec.ts`
- Demo app: `projects/demo/src/app/`
- Demo tests: `projects/demo/src/app/**/*.spec.ts`
- Backend source: `projects/backend/src/`
- Backend .env: `projects/backend/.env` (gitignored)
- Public API: `projects/agentic-ui/src/public-api.ts`
- Demo/library path mapping: `tsconfig.json`
- LiteLLM config: `litellm.config.yaml`
