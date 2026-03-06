module.exports = {
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
  outputFormat: 'both'
};
