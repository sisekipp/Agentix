import type { WorkflowDefinition } from '../types/workflow';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: WorkflowDefinition;
  tags: string[];
}

/**
 * Workflow Templates Service
 * Pre-built workflow templates for common use cases
 */
export class WorkflowTemplates {
  private static templates: WorkflowTemplate[] = [
    {
      id: 'content-generator',
      name: 'Content Generator',
      description:
        'Generate blog content using AI with automatic formatting and SEO optimization',
      category: 'Content Creation',
      tags: ['ai', 'content', 'seo', 'writing'],
      definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 200 },
            data: {
              label: 'Start',
              description: 'Workflow trigger',
              config: {},
            },
          },
          {
            id: 'agent-1',
            type: 'agent',
            position: { x: 300, y: 200 },
            data: {
              label: 'Generate Content',
              description: 'AI generates blog post content',
              config: {
                providerId: '', // User needs to configure
                systemPrompt:
                  'You are a professional content writer. Create engaging, SEO-friendly blog posts.',
                prompt:
                  'Write a blog post about: {{input.topic}}\\n\\nTarget audience: {{input.audience}}\\n\\nKey points to cover: {{input.keyPoints}}',
                temperature: 0.8,
                maxTokens: 2000,
              },
            },
          },
          {
            id: 'agent-2',
            type: 'agent',
            position: { x: 500, y: 200 },
            data: {
              label: 'SEO Optimization',
              description: 'Optimize content for SEO',
              config: {
                providerId: '', // User needs to configure
                systemPrompt:
                  'You are an SEO expert. Optimize content for search engines.',
                prompt:
                  'Optimize the following content for SEO. Add meta description, keywords, and headings:\\n\\n{{agent-1.result}}',
                temperature: 0.5,
                maxTokens: 2500,
              },
            },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'trigger-1', target: 'agent-1' },
          { id: 'e2-3', source: 'agent-1', target: 'agent-2' },
        ],
      },
    },
    {
      id: 'data-analyzer',
      name: 'Data Analyzer',
      description:
        'Fetch data from API, transform it, and generate insights using AI',
      category: 'Data Processing',
      tags: ['api', 'data', 'analytics', 'ai'],
      definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 200 },
            data: {
              label: 'Start',
              description: 'Workflow trigger',
              config: {},
            },
          },
          {
            id: 'tool-1',
            type: 'tool',
            position: { x: 300, y: 200 },
            data: {
              label: 'Fetch Data',
              description: 'Get data from API',
              config: {
                toolId: 'http-request',
                input: {
                  url: '{{input.apiUrl}}',
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
              },
            },
          },
          {
            id: 'tool-2',
            type: 'tool',
            position: { x: 500, y: 200 },
            data: {
              label: 'Transform Data',
              description: 'Extract relevant fields',
              config: {
                toolId: 'data-transform',
                input: {
                  data: '{{tool-1.result.data}}',
                  transformType: 'select',
                  transformConfig: {
                    fields: ['id', 'name', 'value', 'timestamp'],
                  },
                },
              },
            },
          },
          {
            id: 'agent-1',
            type: 'agent',
            position: { x: 700, y: 200 },
            data: {
              label: 'Analyze Data',
              description: 'AI analyzes the data',
              config: {
                providerId: '', // User needs to configure
                systemPrompt:
                  'You are a data analyst. Provide insights and recommendations based on data.',
                prompt:
                  'Analyze the following data and provide key insights:\\n\\n{{tool-2.result}}',
                temperature: 0.6,
                maxTokens: 1500,
              },
            },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'trigger-1', target: 'tool-1' },
          { id: 'e2-3', source: 'tool-1', target: 'tool-2' },
          { id: 'e3-4', source: 'tool-2', target: 'agent-1' },
        ],
      },
    },
    {
      id: 'customer-support',
      name: 'Customer Support Bot',
      description:
        'AI-powered customer support with decision-making and escalation',
      category: 'Customer Service',
      tags: ['support', 'chatbot', 'ai', 'decision'],
      definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 300 },
            data: {
              label: 'Start',
              description: 'Customer inquiry',
              config: {},
            },
          },
          {
            id: 'agent-1',
            type: 'agent',
            position: { x: 300, y: 300 },
            data: {
              label: 'Classify Inquiry',
              description: 'Determine inquiry type',
              config: {
                providerId: '', // User needs to configure
                systemPrompt:
                  'You are a customer support classifier. Categorize inquiries as: simple, complex, or urgent.',
                prompt:
                  'Classify this customer inquiry:\\n\\n{{input.inquiry}}\\n\\nRespond with only: simple, complex, or urgent',
                temperature: 0.3,
                maxTokens: 100,
              },
            },
          },
          {
            id: 'decision-1',
            type: 'decision',
            position: { x: 500, y: 300 },
            data: {
              label: 'Check Complexity',
              description: 'Route based on complexity',
              config: {
                condition: 'agent-1.result.toLowerCase().includes("simple")',
              },
            },
          },
          {
            id: 'agent-2',
            type: 'agent',
            position: { x: 700, y: 200 },
            data: {
              label: 'Auto-Respond',
              description: 'Handle simple inquiries',
              config: {
                providerId: '', // User needs to configure
                systemPrompt:
                  'You are a helpful customer support assistant. Provide clear, friendly responses.',
                prompt:
                  'Respond to this customer inquiry:\\n\\n{{input.inquiry}}',
                temperature: 0.7,
                maxTokens: 500,
              },
            },
          },
          {
            id: 'action-1',
            type: 'action',
            position: { x: 700, y: 400 },
            data: {
              label: 'Escalate to Human',
              description: 'Complex or urgent issues',
              config: {
                action: 'escalate',
                notify: true,
              },
            },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'trigger-1', target: 'agent-1' },
          { id: 'e2-3', source: 'agent-1', target: 'decision-1' },
          {
            id: 'e3-4',
            source: 'decision-1',
            target: 'agent-2',
            data: { label: 'Simple' },
          },
          {
            id: 'e3-5',
            source: 'decision-1',
            target: 'action-1',
            data: { label: 'Complex/Urgent' },
          },
        ],
      },
    },
    {
      id: 'social-media-scheduler',
      name: 'Social Media Scheduler',
      description:
        'Generate and schedule social media posts across platforms',
      category: 'Marketing',
      tags: ['social-media', 'marketing', 'ai', 'automation'],
      definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 200 },
            data: {
              label: 'Start',
              description: 'Workflow trigger',
              config: {},
            },
          },
          {
            id: 'agent-1',
            type: 'agent',
            position: { x: 300, y: 200 },
            data: {
              label: 'Generate Post',
              description: 'AI creates social media post',
              config: {
                providerId: '', // User needs to configure
                systemPrompt:
                  'You are a social media expert. Create engaging posts for different platforms.',
                prompt:
                  'Create a {{input.platform}} post about: {{input.topic}}\\n\\nTone: {{input.tone}}\\n\\nInclude relevant hashtags.',
                temperature: 0.9,
                maxTokens: 300,
              },
            },
          },
          {
            id: 'tool-1',
            type: 'tool',
            position: { x: 500, y: 200 },
            data: {
              label: 'Schedule Post',
              description: 'Post to social media API',
              config: {
                toolId: 'http-request',
                input: {
                  url: '{{input.apiEndpoint}}',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer {{input.apiToken}}',
                  },
                  body: {
                    content: '{{agent-1.result}}',
                    scheduledTime: '{{input.scheduleTime}}',
                  },
                },
              },
            },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'trigger-1', target: 'agent-1' },
          { id: 'e2-3', source: 'agent-1', target: 'tool-1' },
        ],
      },
    },
  ];

  /**
   * Get all templates
   */
  static getAllTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  /**
   * Get template by ID
   */
  static getTemplateById(id: string): WorkflowTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  /**
   * Get templates by category
   */
  static getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return this.templates.filter((t) => t.category === category);
  }

  /**
   * Get all categories
   */
  static getCategories(): string[] {
    return Array.from(new Set(this.templates.map((t) => t.category)));
  }

  /**
   * Search templates
   */
  static searchTemplates(query: string): WorkflowTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.templates.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }
}
