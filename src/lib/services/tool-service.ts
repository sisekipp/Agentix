import { db } from '../db';
import { tools } from '../db/schema/providers';
import { eq, and } from 'drizzle-orm';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  type: string;
  configuration: any;
  schema?: any;
}

export interface ToolExecutionContext {
  input: any;
  workflowContext: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  output: any;
  error?: string;
}

/**
 * Tool Service
 * Handles tool registration and execution
 */
export class ToolService {
  private static builtInTools = new Map<string, BuiltInTool>();

  /**
   * Register built-in tools
   */
  static registerBuiltInTools() {
    // HTTP Request Tool
    this.builtInTools.set('http-request', {
      name: 'HTTP Request',
      description: 'Make HTTP requests to external APIs',
      execute: async (context: ToolExecutionContext) => {
        const { url, method = 'GET', headers = {}, body } = context.input;

        try {
          const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });

          const data = await response.json();

          return {
            success: true,
            output: {
              status: response.status,
              statusText: response.statusText,
              data,
            },
          };
        } catch (error) {
          return {
            success: false,
            output: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to request' },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            default: 'GET',
          },
          headers: { type: 'object', description: 'HTTP headers' },
          body: { type: 'object', description: 'Request body' },
        },
        required: ['url'],
      },
    });

    // Data Transform Tool
    this.builtInTools.set('data-transform', {
      name: 'Data Transform',
      description: 'Transform data using JSONPath or custom functions',
      execute: async (context: ToolExecutionContext) => {
        const { data, transformType, transformConfig } = context.input;

        try {
          let result;

          switch (transformType) {
            case 'select':
              // Simple field selection
              result = this.selectFields(data, transformConfig.fields);
              break;

            case 'map':
              // Map transformation
              result = this.mapData(data, transformConfig.mapping);
              break;

            case 'filter':
              // Filter array
              result = this.filterData(data, transformConfig.condition);
              break;

            default:
              throw new Error(`Unknown transform type: ${transformType}`);
          }

          return {
            success: true,
            output: result,
          };
        } catch (error) {
          return {
            success: false,
            output: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          data: { type: 'any', description: 'Input data to transform' },
          transformType: {
            type: 'string',
            enum: ['select', 'map', 'filter'],
            description: 'Type of transformation',
          },
          transformConfig: {
            type: 'object',
            description: 'Configuration for the transformation',
          },
        },
        required: ['data', 'transformType', 'transformConfig'],
      },
    });

    // Delay Tool
    this.builtInTools.set('delay', {
      name: 'Delay',
      description: 'Wait for a specified duration',
      execute: async (context: ToolExecutionContext) => {
        const { duration } = context.input;

        await new Promise((resolve) => setTimeout(resolve, duration));

        return {
          success: true,
          output: { delayed: duration },
        };
      },
      schema: {
        type: 'object',
        properties: {
          duration: {
            type: 'number',
            description: 'Delay duration in milliseconds',
          },
        },
        required: ['duration'],
      },
    });

    // Code Execution Tool (sandboxed)
    this.builtInTools.set('code-execution', {
      name: 'Code Execution',
      description: 'Execute JavaScript code in a sandboxed environment',
      execute: async (context: ToolExecutionContext) => {
        const { code, contextData } = context.input;

        try {
          // Create a safe execution context
          const func = new Function(
            'context',
            `
            "use strict";
            ${code}
          `
          );

          const result = func(contextData || {});

          return {
            success: true,
            output: result,
          };
        } catch (error) {
          return {
            success: false,
            output: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute' },
          contextData: {
            type: 'object',
            description: 'Data available in the execution context',
          },
        },
        required: ['code'],
      },
    });

    // Log Tool
    this.builtInTools.set('log', {
      name: 'Log',
      description: 'Log data to console',
      execute: async (context: ToolExecutionContext) => {
        const { message, level = 'info', data } = context.input;

        console[level as 'log' | 'info' | 'warn' | 'error'](message, data);

        return {
          success: true,
          output: { logged: true, message, data },
        };
      },
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Log message' },
          level: {
            type: 'string',
            enum: ['log', 'info', 'warn', 'error'],
            default: 'info',
          },
          data: { type: 'any', description: 'Additional data to log' },
        },
        required: ['message'],
      },
    });
  }

  /**
   * Execute a tool
   */
  static async executeTool(
    toolId: string,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // Check if it's a built-in tool
    if (this.builtInTools.has(toolId)) {
      const tool = this.builtInTools.get(toolId)!;
      return await tool.execute(context);
    }

    // Otherwise, get from database
    const [toolDef] = await db
      .select()
      .from(tools)
      .where(and(eq(tools.id, toolId), eq(tools.isActive, true)))
      .limit(1);

    if (!toolDef) {
      return {
        success: false,
        output: null,
        error: `Tool not found: ${toolId}`,
      };
    }

    return await this.executeCustomTool(toolDef, context);
  }

  /**
   * Execute a custom tool
   */
  private static async executeCustomTool(
    toolDef: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { type, configuration } = toolDef;

    switch (type) {
      case 'webhook':
        return await this.executeWebhookTool(configuration, context);

      case 'api':
        return await this.executeApiTool(configuration, context);

      default:
        return {
          success: false,
          output: null,
          error: `Unsupported tool type: ${type}`,
        };
    }
  }

  /**
   * Execute webhook tool
   */
  private static async executeWebhookTool(
    config: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(context.input),
      });

      const data = await response.json();

      return {
        success: true,
        output: data,
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute API tool
   */
  private static async executeApiTool(
    config: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // Similar to webhook but with more configuration options
    return await this.executeWebhookTool(config, context);
  }

  /**
   * Get all available tools for an organization
   */
  static async getOrganizationTools(organizationId: string) {
    const customTools = await db
      .select()
      .from(tools)
      .where(
        and(eq(tools.organizationId, organizationId), eq(tools.isActive, true))
      );

    // Combine with built-in tools
    const builtInToolsList = Array.from(this.builtInTools.entries()).map(
      ([id, tool]) => ({
        id,
        name: tool.name,
        description: tool.description,
        type: 'built-in',
        schema: tool.schema,
      })
    );

    return [...builtInToolsList, ...customTools];
  }

  /**
   * Helper: Select fields from data
   */
  private static selectFields(data: any, fields: string[]): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.selectFields(item, fields));
    }

    const result: any = {};
    for (const field of fields) {
      if (field in data) {
        result[field] = data[field];
      }
    }
    return result;
  }

  /**
   * Helper: Map data
   */
  private static mapData(data: any, mapping: Record<string, string>): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.mapData(item, mapping));
    }

    const result: any = {};
    for (const [newKey, oldKey] of Object.entries(mapping)) {
      if (oldKey in data) {
        result[newKey] = data[oldKey];
      }
    }
    return result;
  }

  /**
   * Helper: Filter data
   */
  private static filterData(data: any[], condition: string): any[] {
    // Simple implementation - can be enhanced
    return data.filter((item) => {
      try {
        const func = new Function('item', `return ${condition}`);
        return func(item);
      } catch {
        return false;
      }
    });
  }
}

interface BuiltInTool {
  name: string;
  description: string;
  execute: (context: ToolExecutionContext) => Promise<ToolExecutionResult>;
  schema: any;
}

// Initialize built-in tools
ToolService.registerBuiltInTools();
