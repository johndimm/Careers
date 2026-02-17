import { LLMProvider, ProviderName } from './types';
import { anthropicProvider } from './provider-anthropic';
import { openaiProvider } from './provider-openai';
import { deepseekProvider } from './provider-deepseek';
import { geminiProvider } from './provider-gemini';

const providers: Record<string, LLMProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  deepseek: deepseekProvider,
  gemini: geminiProvider,
};

export function registerProvider(name: string, provider: LLMProvider): void {
  providers[name] = provider;
}

export function getProvider(name: ProviderName): LLMProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

export function getAvailableProviders(): string[] {
  return Object.keys(providers);
}

export async function generateJSONWithFallback<T>(
  preferredName: ProviderName,
  prompt: string,
  systemPrompt: string,
): Promise<{ result: T; usedProvider: string; usedModel: string }> {
  const preferred = preferredName;
  const others = Object.keys(providers).filter(k => k !== preferred) as ProviderName[];
  const order = [preferred, ...others];
  const errors: string[] = [];

  for (const name of order) {
    const provider = providers[name];
    if (!provider) continue;
    try {
      const result = await provider.generateJSON<T>(prompt, systemPrompt);
      return { result, usedProvider: provider.name, usedModel: provider.model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Provider ${name} failed: ${msg}`);
      errors.push(`${name}: ${msg}`);
    }
  }

  throw new Error(`All LLM providers failed:\n${errors.join('\n')}`);
}
