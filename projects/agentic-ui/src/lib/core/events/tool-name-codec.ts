export type ToolNameKind = 'action' | 'read' | 'write' | 'unknown';

export interface DecodedAction {
  entryId: string;
  actionName: string;
}

export interface DecodedReadable {
  entryId: string;
  readableName: string;
  mode: 'read' | 'write';
}

const ACTION_SEP = '__action__';
const READ_SEP = '__read__';
const WRITE_SEP = '__write__';

export class ToolNameCodec {
  encodeAction(entryId: string, actionName: string): string {
    return `${entryId}${ACTION_SEP}${actionName}`;
  }

  decodeAction(name: string): DecodedAction {
    const idx = name.indexOf(ACTION_SEP);
    if (idx === -1) {
      return { entryId: 'unknown', actionName: name };
    }
    return { entryId: name.slice(0, idx), actionName: name.slice(idx + ACTION_SEP.length) };
  }

  encodeReadable(entryId: string, readableName: string, mode: 'read' | 'write'): string {
    const sep = mode === 'read' ? READ_SEP : WRITE_SEP;
    return `${entryId}${sep}${readableName}`;
  }

  decodeReadable(name: string): DecodedReadable {
    if (name.includes(READ_SEP)) {
      const idx = name.indexOf(READ_SEP);
      return {
        entryId: name.slice(0, idx),
        readableName: name.slice(idx + READ_SEP.length),
        mode: 'read',
      };
    }
    if (name.includes(WRITE_SEP)) {
      const idx = name.indexOf(WRITE_SEP);
      return {
        entryId: name.slice(0, idx),
        readableName: name.slice(idx + WRITE_SEP.length),
        mode: 'write',
      };
    }
    return { entryId: 'unknown', readableName: name, mode: 'read' };
  }

  kind(name: string): ToolNameKind {
    if (name.includes(ACTION_SEP)) return 'action';
    if (name.includes(READ_SEP)) return 'read';
    if (name.includes(WRITE_SEP)) return 'write';
    return 'unknown';
  }
}
