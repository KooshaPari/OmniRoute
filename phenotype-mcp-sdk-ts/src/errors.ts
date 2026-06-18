/// MCP SDK errors.
///
/// Provides a typed error hierarchy for MCP operations.

export class McpError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    Object.setPrototypeOf(this, McpError.prototype);
  }
}

export class ToolNotFoundError extends McpError {
  constructor(toolName: string) {
    super(`tool not found: ${toolName}`, 'TOOL_NOT_FOUND');
    this.name = 'ToolNotFoundError';
    Object.setPrototypeOf(this, ToolNotFoundError.prototype);
  }
}

export class ResourceNotFoundError extends McpError {
  constructor(resourceUri: string) {
    super(`resource not found: ${resourceUri}`, 'RESOURCE_NOT_FOUND');
    this.name = 'ResourceNotFoundError';
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

export class InvalidArgumentsError extends McpError {
  constructor(message: string) {
    super(`invalid arguments: ${message}`, 'INVALID_ARGUMENTS');
    this.name = 'InvalidArgumentsError';
    Object.setPrototypeOf(this, InvalidArgumentsError.prototype);
  }
}

export class TransportError extends McpError {
  constructor(message: string) {
    super(`transport error: ${message}`, 'TRANSPORT_ERROR');
    this.name = 'TransportError';
    Object.setPrototypeOf(this, TransportError.prototype);
  }
}

export class InternalError extends McpError {
  constructor(message: string) {
    super(`internal error: ${message}`, 'INTERNAL_ERROR');
    this.name = 'InternalError';
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}
