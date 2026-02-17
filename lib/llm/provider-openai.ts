import OpenAI from 'openai';
import { LLMProvider } from './types';

const client = new OpenAI();

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async generateJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(text) as T;
  },
};
