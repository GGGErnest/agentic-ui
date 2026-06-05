/**
 * AgentApprovalService — unit tests.
 * Tests ticket lifecycle, approve/reject flows, and pending state.
 */
import { TestBed } from '@angular/core/testing';
import { AgentApprovalService, ApprovalTicket } from './agent-approval.service';

describe('AgentApprovalService', () => {
  let service: AgentApprovalService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AgentApprovalService],
    });
    service = TestBed.inject(AgentApprovalService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== Initial State ==========

  describe('initial state', () => {
    it('should start with no pending ticket', () => {
      expect(service.pending()).toBeNull();
    });

    it('should start with isPending false', () => {
      expect(service.isPending()).toBe(false);
    });
  });

  // ========== Request Approval ==========

  describe('requestApproval', () => {
    it('should set pending ticket with correct data', async () => {
      const promise = service.requestApproval(
        'data-table-1',
        'DataTable',
        'bulkDelete',
        'Delete multiple rows',
        { ids: ['1', '2'] },
      );

      const ticket = service.pending();
      expect(ticket).not.toBeNull();
      expect(ticket!.entryId).toBe('data-table-1');
      expect(ticket!.entryRole).toBe('DataTable');
      expect(ticket!.actionName).toBe('bulkDelete');
      expect(ticket!.actionDescription).toBe('Delete multiple rows');
      expect(ticket!.params).toEqual({ ids: ['1', '2'] });
      expect(service.isPending()).toBe(true);

      // Cleanup: reject so promise resolves
      service.reject();
      await promise;
    });

    it('should return a promise that resolves on approve', async () => {
      const promise = service.requestApproval('btn', 'Button', 'click', 'Click');

      service.approve();
      const result = await promise;
      expect(result).toBe(true);
      expect(service.pending()).toBeNull();
      expect(service.isPending()).toBe(false);
    });

    it('should return a promise that resolves with false on reject', async () => {
      const promise = service.requestApproval('btn', 'Button', 'click', 'Click');

      service.reject();
      const result = await promise;
      expect(result).toBe(false);
      expect(service.pending()).toBeNull();
      expect(service.isPending()).toBe(false);
    });

    it('should queue tickets and process in FIFO order', async () => {
      const promise1 = service.requestApproval('a', 'A', 'x', 'X');
      const promise2 = service.requestApproval('b', 'B', 'y', 'Y');

      // Queue holds both tickets, first is 'a' at front
      expect(service.pending()).not.toBeNull();
      expect(service.pending()!.entryId).toBe('a');
      expect(service.isPending()).toBe(true);

      // Reject first ticket — queue shifts, 'b' becomes front
      service.reject();
      expect(service.pending()!.entryId).toBe('b');
      expect(service.isPending()).toBe(true);

      // Resolve second
      service.reject();
      
      await promise1.catch(() => {});
      await promise2.catch(() => {});
      expect(service.isPending()).toBe(false);
    });

    it('should handle approve with no pending ticket gracefully', () => {
      expect(() => service.approve()).not.toThrow();
      expect(() => service.reject()).not.toThrow();
    });
  });

  // ========== Params handling ==========

  describe('params', () => {
    it('should handle undefined params', async () => {
      const promise = service.requestApproval('btn', 'Button', 'click', 'Click');

      expect(service.pending()!.params).toBeUndefined();

      service.approve();
      await promise;
    });

    it('should handle complex params', async () => {
      const params = {
        ids: ['a', 'b'],
        changes: { status: 'archived', tags: ['vip'] },
      };
      const promise = service.requestApproval('tbl', 'Table', 'bulkEdit', 'Edit rows', params);

      expect(service.pending()!.params).toEqual(params);

      service.approve();
      await promise;
    });
  });

  // ========== Ticket-Id API (interrupt flow) ==========

  describe('requestApprovalTicket', () => {
    it('returns the ticket id alongside the promise', () => {
      const ticket = service.requestApprovalTicket('btn', 'Button', 'click', 'Click');

      expect(ticket.id).toEqual(expect.any(String));
      expect(service.pending()?.id).toBe(ticket.id);
    });

    it('resolves the matching ticket when resolveById is called', async () => {
      const a = service.requestApprovalTicket('a', 'A', 'x', 'X');
      const b = service.requestApprovalTicket('b', 'B', 'y', 'Y');

      let bDone = false;
      void b.promise.then(() => {
        bDone = true;
      });

      service.resolveById(a.id, true);
      const aResult = await a.promise;
      expect(aResult).toBe(true);

      service.resolveById(b.id, false);
      const bResult = await b.promise;
      expect(bDone).toBe(true);
      expect(bResult).toBe(false);
    });

    it('resolves with false when resolveById receives false', async () => {
      const t = service.requestApprovalTicket('btn', 'Button', 'del', 'Delete');
      service.resolveById(t.id, false);
      expect(await t.promise).toBe(false);
    });

    it('removes the ticket from the queue once resolved', () => {
      const t = service.requestApprovalTicket('btn', 'Button', 'click', 'Click');
      service.resolveById(t.id, true);
      expect(service.pending()).toBeNull();
      expect(service.isPending()).toBe(false);
    });

    it('no-ops when called with an unknown id', () => {
      const t = service.requestApprovalTicket('btn', 'Button', 'click', 'Click');
      service.resolveById('not-a-real-id', true);
      expect(service.pending()?.id).toBe(t.id);
      service.resolveById(t.id, true);
    });
  });
});
