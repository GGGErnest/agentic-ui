/**
 * Models for dropzone rendering operations.
 */

export type RenderMode = 'append' | 'replace' | 'clear';

export interface RenderConfig {
  inputs?: Record<string, unknown>;
  mode?: RenderMode;
}

export interface RenderResult {
  componentId: string;
  count: number;
  timestamp: number;
}
