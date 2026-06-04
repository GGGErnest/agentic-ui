import { TestBed } from '@angular/core/testing';
import { StateSnapshotService } from './state-snapshot.service';
import { AgentWorldService } from '../world/agent-world.service';
import type { AgentReadable, AgentReadableResult } from '../state/agent-readable.model';

describe('StateSnapshotService', () => {
  let service: StateSnapshotService;
  let world: AgentWorldService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StateSnapshotService, AgentWorldService],
    });
    service = TestBed.inject(StateSnapshotService);
    world = TestBed.inject(AgentWorldService);
  });

  it('serializes readables into a snapshot keyed by entry/readable', async () => {
    const readable: AgentReadable = {
      name: 'rows',
      description: 'rows',
      schema: { type: 'object', properties: {} },
      read: vi
        .fn()
        .mockResolvedValue({
          success: true,
          message: 'ok',
          value: { count: 3 },
        } as AgentReadableResult),
    };
    world.register({ id: 'tbl', role: 'DataTable', actions: [], readables: [readable] });

    const snap = await service.snapshot();
    expect(snap.state['tbl.rows']).toEqual({ count: 3 });
    expect(snap.truncated).toEqual([]);
  });

  it('computes replace deltas when value changes', async () => {
    const readable: AgentReadable = {
      name: 'count',
      description: 'c',
      schema: { type: 'object', properties: {} },
      read: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          message: 'ok',
          value: { v: 1 },
        } as AgentReadableResult)
        .mockResolvedValueOnce({
          success: true,
          message: 'ok',
          value: { v: 2 },
        } as AgentReadableResult),
    };
    world.register({ id: 'c1', role: 'X', actions: [], readables: [readable] });

    const first = await service.snapshot();
    const second = await service.snapshotAndDiff(first.state);
    expect(second.state['c1.count']).toEqual({ v: 2 });
    expect(second.deltas).toEqual([{ op: 'replace', path: '/c1.count/v', value: 2 }]);
  });

  it('records truncated keys when state contains circular references', async () => {
    const circ: Record<string, unknown> = {};
    circ['self'] = circ;
    const readable: AgentReadable = {
      name: 'bad',
      description: 'b',
      schema: { type: 'object', properties: {} },
      read: vi
        .fn()
        .mockResolvedValue({ success: true, message: 'ok', value: circ } as AgentReadableResult),
    };
    world.register({ id: 'c1', role: 'X', actions: [], readables: [readable] });

    const snap = await service.snapshot();
    expect(Array.isArray(snap.truncated)).toBe(true);
    expect(snap.truncated).toContain('c1.bad');
  });

  it('emits remove deltas when a key disappears from prev to current', async () => {
    const readable: AgentReadable = {
      name: 'present',
      description: 'p',
      schema: { type: 'object', properties: {} },
      read: vi
        .fn()
        .mockResolvedValue({ success: true, message: 'ok', value: 42 } as AgentReadableResult),
    };
    world.register({ id: 'c1', role: 'X', actions: [], readables: [readable] });

    const second = await service.snapshotAndDiff({ 'c1.gone': 'old' });
    expect(second.deltas).toContainEqual({ op: 'remove', path: '/c1.gone' });
  });
});
