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
