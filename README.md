# tuneprompt 🎛️

**The Industrial-Grade Testing Framework for LLM Prompts**

Stop guessing. Start measuring. Automate your prompt engineering workflow.

[![npm version](https://badge.fury.io/js/tuneprompt.svg)](https://www.npmjs.com/package/tuneprompt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ The Problem

LLMs are non-deterministic. "Exact Match" testing fails even when the model is right. You need a way to verify **intent and meaning**, not just strings, inside your CI/CD pipeline.

## 🚀 The Solution

**tuneprompt** is a local-first CLI that treats prompts like code. It uses **Semantic Similarity** (embeddings) to score responses, ensuring your prompt changes don't break your app.

### Key Features (Free Forever)

✅ **Semantic Scoring** - Uses embeddings to verify meaning, not just exact text matches  
✅ **CI/CD Native** - Blocks PRs if prompt accuracy drops below threshold  
✅ **Local History** - SQLite-backed history of every test run  
✅ **Watch Mode** - Iterate on prompts in real-time  
✅ **Multi-Provider** - Supports OpenAI, Anthropic, and OpenRouter  
✅ **Zero Config** - Works out of the box with sensible defaults

---

## 📦 Installation
```bash
npm install -g tuneprompt
```

Or use with npx (no installation):
```bash
npx tuneprompt init
```

---

## 🛠️ Quick Start

### 1. Initialize a project
```bash
tuneprompt init
```

This creates:
- `tuneprompt.config.js` - Your configuration
- `tests/sample.json` - A sample test file
- `.env` - For API keys

### 2. Configure API Keys

Edit `.env`:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Write Test Cases

Create `tests/onboarding.json`:
```json
{
  "description": "User onboarding welcome message",
  "prompt": "Generate a welcome message for a user named Alice.",
  "expect": "Welcome, Alice! We are glad you are here.",
  "config": {
    "threshold": 0.85,
    "method": "semantic"
  }
}
```

### 4. Run Tests
```bash
tuneprompt run
```

**Output:**
```
✓ Configuration loaded
✓ Loaded 1 test case(s)
✓ Running tests...

┌──────────┬──────────────────────────────────────┬───────┬──────────┬──────────┐
│ Status   │ Test                                 │ Score │ Method   │ Duration │
├──────────┼──────────────────────────────────────┼───────┼──────────┼──────────┤
│ ✓ PASS   │ User onboarding welcome message      │ 0.92  │ semantic │ 450ms    │
└──────────┴──────────────────────────────────────┴───────┴──────────┴──────────┘

Summary:
  Total: 1
  Passed: 1
  Failed: 0
  Duration: 450ms
  Cost: $0.0002
```

---

## 🧪 Test Configuration

### Scoring Methods

**1. Semantic Similarity (Recommended)**
```json
{
  "config": {
    "method": "semantic",
    "threshold": 0.85
  }
}
```

Uses embeddings to check if the output **means** the same thing.

**2. Exact Match**
```json
{
  "config": {
    "method": "exact"
  }
}
```

Requires exact string match (case-insensitive).

**3. JSON Validation**
```json
{
  "expect": {
    "status": "success",
    "user": { "name": "Alice" }
  },
  "config": {
    "method": "json"
  }
}
```

Validates JSON structure and values.

### Provider Configuration

**`tuneprompt.config.js`:**
```javascript
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
    }
  },
  
  threshold: 0.8,
  testDir: './tests',
  outputFormat: 'both'
};
```

---

## 🔄 Watch Mode

Continuously run tests as you edit prompts:
```bash
tuneprompt run --watch
```

Perfect for rapid iteration during development.

---

## 🤖 CI/CD Integration

### GitHub Actions

Create `.github/workflows/prompt-test.yml`:
```yaml
name: Prompt Integrity Check

on: [pull_request]

jobs:
  test-prompts:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install & Test
        run: |
          npm install -g tuneprompt
          tuneprompt run --ci
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### GitLab CI

`.gitlab-ci.yml`:
```yaml
test-prompts:
  stage: test
  image: node:18
  script:
    - npm install -g tuneprompt
    - tuneprompt run --ci
  variables:
    OPENAI_API_KEY: $OPENAI_API_KEY
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
```

---

## 📊 View Test History
```bash
tuneprompt history

# Show detailed results
tuneprompt history --detailed

# Limit results
tuneprompt history --limit 5
```

**Output:**
```
📊 Test History

┌────────────────────┬───────┬────────┬────────┬──────────┬───────────┐
│ Date               │ Total │ Passed │ Failed │ Duration │ Pass Rate │
├────────────────────┼───────┼────────┼────────┼──────────┼───────────┤
│ 1/9/2026, 10:30 AM │ 5     │ 5      │ 0      │ 2100ms   │ 100.0%    │
│ 1/9/2026, 9:15 AM  │ 5     │ 4      │ 1      │ 1950ms   │ 80.0%     │
└────────────────────┴───────┴────────┴────────┴──────────┴───────────┘
```

---

## 🧠 Premium Features (Coming Soon)

### 🔮 Auto-Fix Engine (`tuneprompt fix`)

When tests fail, don't manually tweak prompts. Run:
```bash
tuneprompt fix
```

Our AI analyzes:
- Why the test failed
- What the model should have generated
- How to rewrite the prompt to pass

**Example workflow:**
```bash
$ tuneprompt run
❌ FAIL: "Customer support response" (Score: 0.45)

💡 HINT: Run `tuneprompt fix` to let AI repair this prompt instantly.

$ tuneprompt fix
🧠 Analyzing failure patterns...
⚡ Generating optimized prompt candidates...

Suggested fix:
- Original: "Help the customer"
+ Optimized: "Respond professionally to the customer's issue with empathy..."

Accept this fix? (y/n) y
✓ Prompt updated successfully
```

### 📊 Cloud Dashboard

- Team collaboration & shared history
- Regression visualization (accuracy over time)
- Cost tracking per test run
- Prompt version comparison

### 🎯 LLM-as-a-Judge Scoring

Use GPT-4 to grade responses on:
- Accuracy
- Tone
- Safety
- Format compliance

---

## 📖 Advanced Usage

### System + User Prompts
```json
{
  "description": "Customer support with context",
  "prompt": {
    "system": "You are a helpful customer support agent.",
    "user": "My order hasn't arrived. Order #12345."
  },
  "expect": "I apologize for the delay. Let me check order #12345...",
  "config": {
    "method": "semantic",
    "threshold": 0.80
  }
}
```

### Variables in Prompts
```json
{
  "description": "Personalized greeting",
  "prompt": "Greet the user {{name}} and mention their {{plan}} subscription.",
  "variables": {
    "name": "Alice",
    "plan": "Premium"
  },
  "expect": "Hello Alice! Thank you for being a Premium subscriber.",
  "config": {
    "threshold": 0.85
  }
}
```

### YAML Tests

Create `tests/support.yaml`:
```yaml
- description: Password reset email
  prompt: Generate a password reset email for user@example.com
  expect: We received a request to reset your password...
  config:
    method: semantic
    threshold: 0.85

- description: Order confirmation
  prompt: Generate order confirmation for order #789
  expect: Your order #789 has been confirmed...
  config:
    method: semantic
    threshold: 0.80
```

---

## 🔧 Troubleshooting

### "No tuneprompt config found"

Run `tuneprompt init` to create configuration files.

### "Provider not configured"

Make sure your `.env` file contains valid API keys:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Tests always fail with score 0.0

1. Check that your API keys are valid
2. Verify the model name in config matches provider
3. Try running with `--debug` flag (coming soon)

### "Semantic scoring requires OpenAI provider"

Embeddings currently require OpenAI. Make sure you have `openai` configured in your `tuneprompt.config.js`.

---

## 🛣️ Roadmap

- [x] Phase 1: Core Engine, Semantic Scoring, CI/CD Integration
- [ ] Phase 2: `tuneprompt fix` (Auto-Optimization)
- [ ] Phase 3: Web Dashboard & Analytics
- [ ] Phase 4: LLM-as-a-Judge Scoring
- [ ] Phase 5: Matrix Testing (multi-model comparison)
- [ ] Phase 6: Enterprise SSO & RBAC

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

---

## 📄 License

MIT © TunePrompt

---

## 💬 Support

- 📧 Email: support@tuneprompt.com
- 💬 Discord: [Join our community](https://discord.gg/tuneprompt)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/tuneprompt/issues)

---

**Stop guessing. Start measuring. Try TunePrompt today.**
```bash
npm install -g tuneprompt
tuneprompt init
```