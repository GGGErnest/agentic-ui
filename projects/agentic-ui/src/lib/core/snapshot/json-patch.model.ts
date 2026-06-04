/**
 * JSON Patch (RFC 6902 subset) — the wire format for state deltas emitted by
 * `StateSnapshotService.snapshotAndDiff`. We use only the three primitives the
 * shell needs: add, remove, replace. Other ops (move, copy, test) are out of
 * scope for the initial snapshot sync.
 */
export type JsonPatchOp =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown };

export type JsonPatch = JsonPatchOp[];

/** Maximum size of a single serialized patch value before we mark STATE_TOO_LARGE. */
export const JSON_PATCH_MAX_VALUE_BYTES = 4096;
