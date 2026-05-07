# AGENTS.md

Guidance for agents working in the `agentic-ui` Angular CLI monorepo.

## Scope And Tech Stack

**Project type:** Angular CLI (not Nx) with two projects: a library `agentic-ui` and a demo app.

- **Package manager:** npm (lockfile: `package-lock.json`)
- **Angular version:** ^21.2.0 / TypeScript ~5.9.2 / Vitest ^4.0.8
- **Library builder:** ng-packagr with entrypoint at `projects/agentic-ui/src/public-api.ts`
- **Library output:** `dist/agentic-ui`
- **Demo app:** Angular CLI application at `projects/demo`
- **Root tsconfig import path:** `"agentic-ui": ["./dist/agentic-ui"]`

## Critical Architecture Notes

**The demo app consumes the built library output, not source.**

After any change to `projects/agentic-ui/src/`, you must rebuild the library before validating the demo:

```bash
ng build agentic-ui
```

Then re-run or restart the demo. The `agentic-ui` import path in demo's tsconfig points to `dist/agentic-ui`, so stale builds will mask changes.

**Demo provides mock LLM provider.**

`projects/demo/src/app/app.config.ts` exports a mock `LLM_PROVIDER` for demo purposes only. It does not wire real APIs.

## Commands

### Install Dependencies
```bash
npm install
```

### Start Demo App (Development)
```bash
npm start
```

Default serves the `demo` project (the application target) on localhost.

Alternatives:
```bash
ng serve demo                           # explicit
ng serve demo --configuration development
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
│   └── demo/                     # Demo app
│       ├── src/
│       │   ├── main.ts          # Bootstrap
│       │   ├── app/
│       │   └── styles.scss
│       └── tsconfig.app.json
├── dist/agentic-ui/             # Library build output (consumed by demo)
├── angular.json
├── tsconfig.json                # Root (includes import path mapping)
└── package.json
```

## Common Gotchas

1. **Demo doesn't see library changes until rebuild.** Always run `ng build agentic-ui` after library source changes, before validating the demo.

2. **Strict TypeScript by default.** Root tsconfig uses `"strict": true` with `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, and `noImplicitReturns`.

3. **No lint command.** The repo has no configured linter. Rely on Prettier for formatting and TypeScript compiler errors.

4. **Vitest globals.** Test specs include `vitest/globals`, so `describe`, `it`, `expect` are available without imports.

## Conventions

- **Component prefix for library:** `agui-` (configured in `angular.json`)
- **Component prefix for demo:** `app-` (configured in `angular.json`)
- **SCSS:** Demo uses SCSS by default (see `projects/demo/schematics` in `angular.json`)

## Useful Paths

- Library source: `projects/agentic-ui/src/lib/`
- Library tests: `projects/agentic-ui/src/lib/**/*.spec.ts`
- Demo app: `projects/demo/src/app/`
- Demo tests: `projects/demo/src/app/**/*.spec.ts`
- Public API: `projects/agentic-ui/src/public-api.ts`
