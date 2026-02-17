import OpenAI from 'openai';
import { LLMProvider } from './types';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export const deepseekProvider: LLMProvider = {
  name: 'deepseek',

  async generateJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('No response from DeepSeek');
    }

    return JSON.parse(text) as T;
  },
};
