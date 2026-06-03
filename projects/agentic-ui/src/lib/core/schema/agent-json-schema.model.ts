/**
 * JSON Schema model for defining structured input and state schemas.
 * Used by actions (inputSchema) and state (readables).
 * Follows JSON Schema draft for OpenAI compatibility.
 */

/** Core JSON Schema property definition. */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number | boolean)[];
  items?: JsonSchemaProperty; // For arrays
  properties?: Record<string, JsonSchemaProperty>; // For objects
  required?: string[]; // For objects
  additionalProperties?: boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  $ref?: string; // For references (not fully expanded)
}

/** Full JSON Schema definition (JSON Schema draft-07 compatible). */
export interface AgentJsonSchema {
  $schema?: string; // e.g., 'http://json-schema.org/draft-07/schema#'
  type: 'object';
  title?: string;
  description?: string;
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}
