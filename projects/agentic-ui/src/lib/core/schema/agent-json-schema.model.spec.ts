import { AgentJsonSchema, JsonSchemaProperty } from './agent-json-schema.model';

describe('AgentJsonSchema', () => {
  it('creates a valid schema with properties', () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      title: 'User',
      description: 'A user object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier',
        },
        age: {
          type: 'integer',
          minimum: 0,
          maximum: 150,
        },
      },
      required: ['id'],
    };

    expect(schema.type).toBe('object');
    expect(schema.properties['id'].type).toBe('string');
    expect(schema.properties['age'].minimum).toBe(0);
    expect(schema.required).toContain('id');
  });

  it('supports nested object properties', () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
          required: ['city'],
        },
      },
    };

    const address = schema.properties['address'] as JsonSchemaProperty;
    expect(address.type).toBe('object');
    expect(address.properties?.['city'].type).toBe('string');
    expect(address.required).toContain('city');
  });

  it('supports array properties with item schema', () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
        },
      },
    };

    const tags = schema.properties['tags'] as JsonSchemaProperty;
    expect(tags.type).toBe('array');
    expect(tags.items?.type).toBe('string');
    expect(tags.items?.minLength).toBe(1);
  });

  it('supports enum constraints', () => {
    const schema: AgentJsonSchema = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending'],
        },
      },
    };

    const status = schema.properties['status'] as JsonSchemaProperty;
    expect(status.enum).toEqual(['active', 'inactive', 'pending']);
  });
});
