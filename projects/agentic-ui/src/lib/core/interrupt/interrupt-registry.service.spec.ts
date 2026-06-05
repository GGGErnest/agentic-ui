import { TestBed } from '@angular/core/testing';
import { InterruptRegistryService } from './interrupt-registry.service';

describe('InterruptRegistryService', () => {
  let service: InterruptRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [InterruptRegistryService] });
    service = TestBed.inject(InterruptRegistryService);
  });

  it('stores interrupts keyed by runId', () => {
    service.register({
      runId: 'r1',
      interrupt: {
        id: 'i1',
        toolCallId: 'c1',
        reason: 'approval_required',
        entryId: 'a',
        actionName: 'b',
        params: {},
      },
    });
    expect(service.pending('r1')).toHaveLength(1);
    expect(service.pending('r1')[0].id).toBe('i1');
  });

  it('clears interrupts on consume', () => {
    service.register({
      runId: 'r1',
      interrupt: {
        id: 'i1',
        toolCallId: 'c1',
        reason: 'approval_required',
        entryId: 'a',
        actionName: 'b',
        params: {},
      },
    });
    const ints = service.consume('r1', ['i1']);
    expect(ints).toHaveLength(1);
    expect(ints[0].id).toBe('i1');
    expect(service.pending('r1')).toHaveLength(0);
  });

  it('ignores stale interrupt ids', () => {
    service.register({
      runId: 'r1',
      interrupt: {
        id: 'i1',
        toolCallId: 'c1',
        reason: 'approval_required',
        entryId: 'a',
        actionName: 'b',
        params: {},
      },
    });
    const ints = service.consume('r1', ['i_old']);
    expect(ints).toHaveLength(0);
    expect(service.pending('r1')).toHaveLength(1);
  });

  it('clear() drops all interrupts for a run', () => {
    service.register({
      runId: 'r1',
      interrupt: { id: 'i1', toolCallId: 'c1', reason: 'r', entryId: 'a', actionName: 'b', params: {} },
    });
    service.register({
      runId: 'r1',
      interrupt: { id: 'i2', toolCallId: 'c2', reason: 'r', entryId: 'a', actionName: 'b', params: {} },
    });
    service.clear('r1');
    expect(service.pending('r1')).toHaveLength(0);
  });
});
