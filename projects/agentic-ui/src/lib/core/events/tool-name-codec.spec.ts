import { describe, it, expect } from 'vitest';
import { ToolNameCodec } from './tool-name-codec';

describe('ToolNameCodec', () => {
  const codec = new ToolNameCodec();

  describe('action', () => {
    it('encodes entryId + actionName', () => {
      expect(codec.encodeAction('tbl-1', 'deleteRow')).toBe('tbl-1__action__deleteRow');
    });
    it('decodes back to entryId + actionName', () => {
      expect(codec.decodeAction('tbl-1__action__deleteRow')).toEqual({
        entryId: 'tbl-1',
        actionName: 'deleteRow',
      });
    });
    it('roundtrips', () => {
      const name = codec.encodeAction('comp_x', 'do_thing');
      expect(codec.decodeAction(name)).toEqual({ entryId: 'comp_x', actionName: 'do_thing' });
    });
  });

  describe('readable', () => {
    it('encodes read mode', () => {
      expect(codec.encodeReadable('c1', 'rows', 'read')).toBe('c1__read__rows');
    });
    it('encodes write mode', () => {
      expect(codec.encodeReadable('c1', 'rows', 'write')).toBe('c1__write__rows');
    });
    it('decodes read mode', () => {
      expect(codec.decodeReadable('c1__read__rows')).toEqual({
        entryId: 'c1',
        readableName: 'rows',
        mode: 'read',
      });
    });
    it('decodes write mode', () => {
      expect(codec.decodeReadable('c1__write__rows')).toEqual({
        entryId: 'c1',
        readableName: 'rows',
        mode: 'write',
      });
    });
  });

  describe('kind detection', () => {
    it('detects action', () => {
      expect(codec.kind('a__action__b')).toBe('action');
    });
    it('detects read', () => {
      expect(codec.kind('a__read__b')).toBe('read');
    });
    it('detects write', () => {
      expect(codec.kind('a__write__b')).toBe('write');
    });
    it('returns unknown for unparseable', () => {
      expect(codec.kind('plain')).toBe('unknown');
    });
  });
});
