import { Injectable, inject } from '@angular/core';
import { AgentWorldService } from '../world/agent-world.service';
import type { JsonPatch, JsonPatchOp } from './json-patch.model';

export interface SnapshotResult {
  state: Record<string, unknown>;
  truncated: string[];
}

export interface SnapshotAndDiffResult {
  state: Record<string, unknown>;
  truncated: string[];
  deltas: JsonPatch;
}

const MAX_DEPTH = 5;
const MAX_STRING = 5000;
const TRUNCATED_SENTINEL = '<truncated>';

interface SerializeResult {
  value: unknown;
  truncated: boolean;
}

function serialize(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): SerializeResult {
  if (value === null || value === undefined) return { value, truncated: false };
  if (typeof value === 'string') {
    if (value.length > MAX_STRING) return { value: TRUNCATED_SENTINEL, truncated: true };
    return { value, truncated: false };
  }
  if (typeof value === 'number' || typeof value === 'boolean') return { value, truncated: false };
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return { value: TRUNCATED_SENTINEL, truncated: true };
  }
  if (typeof value !== 'object') return { value: TRUNCATED_SENTINEL, truncated: true };
  const obj = value as object;
  if (seen.has(obj)) return { value: TRUNCATED_SENTINEL, truncated: true };
  if (depth >= MAX_DEPTH) return { value: TRUNCATED_SENTINEL, truncated: true };
  seen.add(obj);
  if (Array.isArray(obj)) {
    const out: unknown[] = [];
    let truncated = false;
    for (const item of obj) {
      const r = serialize(item, depth + 1, seen);
      out.push(r.value);
      if (r.truncated) truncated = true;
    }
    return { value: out, truncated };
  }
  const out: Record<string, unknown> = {};
  let truncated = false;
  for (const [k, v] of Object.entries(obj)) {
    const r = serialize(v, depth + 1, seen);
    out[k] = r.value;
    if (r.truncated) truncated = true;
  }
  return { value: out, truncated };
}

function diffStates(prev: Record<string, unknown>, next: Record<string, unknown>): JsonPatch {
  const ops: JsonPatchOp[] = [];
  for (const key of Object.keys(prev)) {
    if (!(key in next)) {
      ops.push({ op: 'remove', path: `/${escapeKey(key)}` });
    } else if (!deepEqual(prev[key], next[key])) {
      emitReplace(ops, '', key, next[key]);
    }
  }
  for (const key of Object.keys(next)) {
    if (!(key in prev)) {
      ops.push({ op: 'add', path: `/${escapeKey(key)}`, value: next[key] });
    }
  }
  return ops;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}

function emitReplace(ops: JsonPatchOp[], prefix: string, key: string, value: unknown): void {
  const path = `${prefix}/${escapeKey(key)}`;
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      emitReplace(ops, path, k, v);
    }
  } else {
    ops.push({ op: 'replace', path, value });
  }
}

function escapeKey(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * StateSnapshotService — reads all registered agent entries and produces a
 * stable, JSON-safe snapshot keyed by `${entryId}.${readableName}`.
 * Diffs against a previous snapshot yield RFC 6902-style patches.
 * Truncates values that exceed depth, size, or contain circular references.
 */
@Injectable({ providedIn: 'root' })
export class StateSnapshotService {
  private readonly world = inject(AgentWorldService);

  async snapshot(): Promise<SnapshotResult> {
    const state: Record<string, unknown> = {};
    const truncated: string[] = [];
    for (const entry of this.world.entries().values()) {
      for (const readable of entry.readables ?? []) {
        try {
          const result = await readable.read();
          if (!result.success) continue;
          const key = `${entry.id}.${readable.name}`;
          const r = serialize(result.value);
          state[key] = r.value;
          if (r.truncated) truncated.push(key);
        } catch {
          /* ignore individual read failures */
        }
      }
    }
    return { state, truncated };
  }

  async snapshotAndDiff(prev: Record<string, unknown>): Promise<SnapshotAndDiffResult> {
    const { state, truncated } = await this.snapshot();
    const deltas = diffStates(prev, state);
    return { state, truncated, deltas };
  }
}
