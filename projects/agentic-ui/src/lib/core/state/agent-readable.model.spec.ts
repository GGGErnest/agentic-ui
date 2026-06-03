import { AgentReadable, AgentReadableDef, AgentReadableResult, AgentWritableResult } from './agent-readable.model';
import { AgentJsonSchema } from '../schema/agent-json-schema.model';

describe('AgentReadable', () => {
  it('creates a read-only readable', async () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      properties: {
        value: { type: 'number' },
      },
    };

    const readable: AgentReadable = {
      name: 'temperature',
      description: 'Current temperature',
      schema,
      writable: false,
      read: async () => ({
        success: true,
        message: 'Temperature read',
        value: 72.5,
      }),
    };

    const result = await readable.read();
    expect(result.success).toBe(true);
    expect(result.value).toBe(72.5);
    expect(readable.writable).toBe(false);
  });

  it('creates a writable readable with getter and setter', async () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      properties: {
        value: { type: 'string' },
      },
    };

    let state = 'off';

    const readable: AgentReadable = {
      name: 'power_state',
      description: 'Device power state',
      schema,
      writable: true,
      read: async () => ({
        success: true,
        message: 'State read',
        value: state,
      }),
      write: async (value: unknown) => {
        state = String(value);
        return {
          success: true,
          message: `State updated to ${state}`,
        };
      },
    };

    const readResult = await readable.read();
    expect(readResult.value).toBe('off');

    const writeResult = await readable.write?.('on');
    expect(writeResult?.success).toBe(true);
    expect(state).toBe('on');

    const readAgain = await readable.read();
    expect(readAgain.value).toBe('on');
  });

  it('handles read failures gracefully', async () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      properties: { value: { type: 'string' } },
    };

    const readable: AgentReadable = {
      name: 'sensor',
      description: 'A sensor reading',
      schema,
      read: async () => ({
        success: false,
        message: 'Sensor timeout',
      }),
    };

    const result = await readable.read();
    expect(result.success).toBe(false);
    expect(result.message).toContain('timeout');
  });

  it('handles write failures gracefully', async () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      properties: { value: { type: 'string' } },
    };

    const readable: AgentReadable = {
      name: 'config',
      description: 'A config option',
      schema,
      writable: true,
      read: async () => ({ success: true, message: 'OK', value: 'current' }),
      write: async () => ({
        success: false,
        message: 'Permission denied',
      }),
    };

    const result = await readable.write?.('new');
    expect(result?.success).toBe(false);
  });
});
