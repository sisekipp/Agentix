import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { db } from '../db';
import { llmProviders } from '../db/schema/providers';
import { eq, and } from 'drizzle-orm';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMProvider {
  id: string;
  name: string;
  provider: string;
  model: string;
  organizationId: string;
}

/**
 * LLM Provider Service
 * Handles interactions with different LLM providers
 */
export class LLMProviderService {
  /**
   * Generate text using a specific provider
   */
  static async generate(
    providerId: string,
    options: LLMGenerateOptions
  ): Promise<{ text: string; usage?: any }> {
    const provider = await this.getProvider(providerId);

    if (!provider) {
      throw new Error(`LLM Provider not found: ${providerId}`);
    }

    const model = this.getModel(provider);

    const result = await generateText({
      model,
      messages: options.messages,
      temperature: options.temperature || 0.7,
    });

    return {
      text: result.text,
      usage: result.usage,
    };
  }

  /**
   * Stream text using a specific provider
   */
  static async stream(
    providerId: string,
    options: LLMGenerateOptions
  ): Promise<any> {
    const provider = await this.getProvider(providerId);

    if (!provider) {
      throw new Error(`LLM Provider not found: ${providerId}`);
    }

    const model = this.getModel(provider);

    return streamText({
      model,
      messages: options.messages,
      temperature: options.temperature || 0.7,
    });
  }

  /**
   * Get provider configuration from database
   */
  private static async getProvider(providerId: string) {
    const [provider] = await db
      .select()
      .from(llmProviders)
      .where(and(eq(llmProviders.id, providerId), eq(llmProviders.isActive, true)))
      .limit(1);

    return provider;
  }

  /**
   * Get the appropriate model instance based on provider type
   */
  private static getModel(provider: any) {
    const providerType = provider.provider.toLowerCase();
    const modelName = provider.model;

    switch (providerType) {
      case 'openai':
        return openai(modelName);

      case 'anthropic':
        return anthropic(modelName);

      case 'google':
        return google(modelName);

      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }

  /**
   * Get all active providers for an organization
   */
  static async getOrganizationProviders(organizationId: string) {
    return await db
      .select({
        id: llmProviders.id,
        name: llmProviders.name,
        provider: llmProviders.provider,
        model: llmProviders.model,
        organizationId: llmProviders.organizationId,
      })
      .from(llmProviders)
      .where(
        and(
          eq(llmProviders.organizationId, organizationId),
          eq(llmProviders.isActive, true)
        )
      );
  }

  /**
   * Test a provider connection
   */
  static async testProvider(providerId: string): Promise<boolean> {
    try {
      const result = await this.generate(providerId, {
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" if you can read this.',
          },
        ],
        maxTokens: 50,
      });

      return result.text.toLowerCase().includes('test successful');
    } catch (error) {
      console.error('Provider test failed:', error);
      return false;
    }
  }

  /**
   * Create a new LLM provider
   */
  static async createProvider(data: {
    organizationId: string;
    name: string;
    provider: string;
    model: string;
    apiKey: string;
    configuration?: any;
  }) {
    const [provider] = await db
      .insert(llmProviders)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        provider: data.provider,
        model: data.model,
        apiKey: data.apiKey, // TODO: Encrypt this
        configuration: data.configuration || {},
        isActive: true,
      })
      .returning();

    return provider;
  }
}
