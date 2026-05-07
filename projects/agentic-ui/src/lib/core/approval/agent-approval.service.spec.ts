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

    it('should only have one pending ticket at a time', async () => {
      const promise1 = service.requestApproval('a', 'A', 'x', 'X');
      const firstTicket = service.pending();

      const promise2 = service.requestApproval('b', 'B', 'y', 'Y');

      // Second call overwrites first
      expect(service.pending()).not.toBeNull();
      expect(service.pending()!.entryId).toBe('b');

      // First promise is abandoned but not leaked — let's clean up
      service.reject();
      await promise2;
      // promise1 is forgotten (GC'd), but no crash
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
});
