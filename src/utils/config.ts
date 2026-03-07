import { cosmiconfig } from 'cosmiconfig';
import { TunePromptConfig } from '../types';
import * as path from 'path';
import * as fs from 'fs';

const explorer = cosmiconfig('tuneprompt');

export async function loadConfig(configPath?: string): Promise<TunePromptConfig> {
  let result;

  if (configPath) {
    result = await explorer.load(configPath);
  } else {
    result = await explorer.search();
  }

  if (!result || !result.config) {
    throw new Error(
      'No tuneprompt config found. Run "tuneprompt init" to create one.'
    );
  }

  return validateConfig(result.config);
}

function validateConfig(config: any): TunePromptConfig {
  if (!config.providers || Object.keys(config.providers).length === 0) {
    throw new Error('At least one provider must be configured');
  }

  // Validate API keys - ensure at least one provider is valid
  const validProviders = Object.entries(config.providers as Record<string, any>)
    .filter(([_, cfg]) => !!cfg.apiKey);

  if (validProviders.length === 0) {
    throw new Error('No valid API keys found. Please provide at least one API key in your .env file.');
  }

  return {
    threshold: config.threshold || 0.8,
    testDir: config.testDir || './tests',
    outputFormat: config.outputFormat || 'table',
    ...config
  };
}

export function getDefaultConfigTemplate(): string {
  return `module.exports = {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o',
      maxTokens: 1000,
      temperature: 0.7
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1000,
      temperature: 0.7
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      maxTokens: 1000,
      temperature: 0.7
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'nvidia/nemotron-3-nano-30b-a3b:free',
      maxTokens: 400,
      temperature: 0.7
    }
  },
  
  // Global semantic similarity threshold
  threshold: 0.8,
  
  // Directory containing test files
  testDir: './tests',
  
  // Output format: 'json', 'table', or 'both'
  outputFormat: 'table'
};
`;
}