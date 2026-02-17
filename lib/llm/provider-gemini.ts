import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const geminiProvider: LLMProvider = {
  name: 'gemini',
  model: 'gemini-1.5-flash',

  async generateJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: systemPrompt }] },
    });

    const text = result.response.text();
    if (!text) {
      throw new Error('No response from Gemini');
    }

    return JSON.parse(text) as T;
  },
};
