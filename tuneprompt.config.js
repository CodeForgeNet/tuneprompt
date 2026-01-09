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
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'mistralai/mistral-7b-instruct:free',
      maxTokens: 450,
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
