import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from './types';

const client = new Anthropic();

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  async generateJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Anthropic');
    }

    let text = textBlock.text.trim();
    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(text) as T;
  },
};
