import { AgentJsonSchema, JsonSchemaProperty } from './agent-json-schema.model';

export interface SchemaValidationResult {
  valid: boolean;
  message?: string;
}

export function validateAgentJsonSchema(schema: AgentJsonSchema, value: unknown): SchemaValidationResult {
  return validateObjectSchema(schema, value);
}

function validateObjectSchema(schema: AgentJsonSchema, value: unknown): SchemaValidationResult {
  if (!isRecord(value)) {
    return { valid: false, message: 'Expected object value.' };
  }

  for (const key of schema.required ?? []) {
    if (!(key in value)) {
      return { valid: false, message: `Missing required property "${key}".` };
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!(schema.properties ?? {})[key]) {
        return { valid: false, message: `Unexpected property "${key}".` };
      }
    }
  }

  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    const result = validateProperty(propSchema, value[key]);
    if (!result.valid) {
      return { valid: false, message: `${key}: ${result.message}` };
    }
  }

  return { valid: true };
}

function validateProperty(schema: JsonSchemaProperty, value: unknown): SchemaValidationResult {
  if (schema.type === 'string') {
    if (typeof value !== 'string') return { valid: false, message: 'Expected string.' };
    if (schema.enum && !schema.enum.includes(value)) return { valid: false, message: 'Value not in enum.' };
    if (schema.minLength !== undefined && value.length < schema.minLength) return { valid: false, message: 'Too short.' };
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return { valid: false, message: 'Too long.' };
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return { valid: false, message: 'Pattern mismatch.' };
    return { valid: true };
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || Number.isNaN(value)) return { valid: false, message: 'Expected number.' };
    if (schema.type === 'integer' && !Number.isInteger(value)) return { valid: false, message: 'Expected integer.' };
    if (schema.minimum !== undefined && value < schema.minimum) return { valid: false, message: 'Below minimum.' };
    if (schema.maximum !== undefined && value > schema.maximum) return { valid: false, message: 'Above maximum.' };
    if (schema.enum && !schema.enum.includes(value)) return { valid: false, message: 'Value not in enum.' };
    return { valid: true };
  }

  if (schema.type === 'boolean') {
    return typeof value === 'boolean' ? { valid: true } : { valid: false, message: 'Expected boolean.' };
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) return { valid: false, message: 'Expected array.' };
    for (let i = 0; i < value.length; i++) {
      const result = validateProperty(schema.items ?? { type: 'string' }, value[i]);
      if (!result.valid) return { valid: false, message: `Item ${i}: ${result.message}` };
    }
    return { valid: true };
  }

  if (schema.type === 'object') {
    if (!isRecord(value)) return { valid: false, message: 'Expected object.' };
    const nestedSchema: AgentJsonSchema = {
      type: 'object',
      properties: schema.properties ?? {},
      required: schema.required,
      additionalProperties: schema.additionalProperties,
    };
    return validateObjectSchema(nestedSchema, value);
  }

  return { valid: false, message: 'Unsupported schema type.' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
