# tuneprompt 🎛️

**Stop guessing. Start measuring. Automate your prompt engineering.**

`tuneprompt` is a local-first CLI framework that treats prompts like unit tests. It moves LLM evaluation from "vibes" to deterministic and semantic scoring, directly inside your CI/CD pipeline.

---

## ⚡ The Problem

LLMs are non-deterministic. Traditional "Exact Match" testing fails because a model might be 100% correct but use different wording. This makes it difficult to maintain consistent quality and reliability in production applications that depend on LLM outputs.

## 🚀 The Solution

`tuneprompt` uses **Semantic Similarity** (embeddings) to score responses based on intent and meaning, not just strings. If your prompt changes cause a regression, your build fails.

### Key Features

* **Semantic Scoring (FREE):** Uses local embeddings to verify output meaning against expectations.
* **CI/CD Native:** Integrates seamlessly with GitHub Actions, GitLab CI, and other CI/CD platforms to block regressions.
* **Watch Mode:** Iterate on prompts in real-time with instant feedback.
* **Multi-Provider Support:** Works with OpenAI, Anthropic, OpenRouter, and custom LLM endpoints.
* **Auto-Fix (Premium):** Don't just find errors—fix them. Our engine rewrites failing prompts automatically.
* **Performance Metrics:** Track latency, token usage, and cost alongside semantic accuracy.

---

## 📦 Installation

```bash
npm install -g tuneprompt
```

Or use npx without installation:

```bash
npx tuneprompt@latest run
```

---

## 🛠️ Quick Start

### 1. Initialize your project

This creates a `tuneprompt.config.js` and a sample test directory.

```bash
tuneprompt init
```

### 2. Define a Test Case (`tests/onboarding.json`)

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

### 3. Run the Suite

```bash
tuneprompt run
```

### 4. Watch Mode for Development

Iterate on prompts with live feedback:

```bash
tuneprompt watch
```

---

## 🧪 Test Configuration

Tests are defined as JSON files in your test directory. Each test includes:

- `description`: Human-readable description of the test
- `prompt`: The input prompt to test
- `expect`: Expected output for semantic comparison
- `config`: Test-specific configuration options

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `threshold` | Number | Semantic similarity threshold (0.0 - 1.0) |
| `method` | String | Scoring method (`semantic`, `exact`, `regex`) |
| `provider` | String | LLM provider to use for this test |
| `timeout` | Number | Request timeout in milliseconds |

---

## 🤖 Continuous Integration

Ensure prompt integrity on every Pull Request. Add this to `.github/workflows/prompt-test.yml`:

```yaml
name: Prompt Integrity Check
on: [pull_request]
jobs:
  test-prompts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install & Test
        run: |
          npm install -g tuneprompt
          tuneprompt run --ci
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

For GitLab CI, add this to `.gitlab-ci.yml`:

```yaml
prompt-tests:
  stage: test
  script:
    - npm install -g tuneprompt
    - tuneprompt run --ci
  variables:
    OPENAI_API_KEY: $CI_OPENAI_API_KEY
```

---

## 🧠 Premium: The "Auto-Fix" Engine

**Stop tweaking words manually.** When a test fails, `tuneprompt` doesn't just complain—it solves.

```bash
tuneprompt fix
```

The engine analyzes the failure, extracts constraints, and uses iterative meta-prompting to **rewrite your prompt** until it passes the test.

---

## 📜 Configuration

Create a `tuneprompt.config.js` file in your project root:

```javascript
// tuneprompt.config.js
module.exports = {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o',
      temperature: 0.7
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet'
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'openai/gpt-4o'
    }
  },
  testDir: './tests',           // Directory containing test files
  threshold: 0.8,              // Default semantic similarity
  timeout: 30000,              // Default request timeout (ms)
  concurrency: 5,              // Number of concurrent requests
  verbose: false               // Enable detailed logging
};
```

### Environment Variables

Set these environment variables to configure your LLM providers:

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `OPENROUTER_API_KEY` - OpenRouter API key
- `TUNEPROMPT_LICENSE_KEY` - Premium license key

---

## 🛠️ CLI Commands

| Command | Description |
|---------|-------------|
| `tuneprompt init` | Initialize a new project with config and sample tests |
| `tuneprompt run` | Run all tests once |
| `tuneprompt watch` | Watch for changes and run tests automatically |
| `tuneprompt fix` | Auto-fix failing prompts (premium) |
| `tuneprompt report` | Generate detailed test reports |
| `tuneprompt activate` | Activate premium features |

### CLI Options

- `--ci` - CI mode (exits with code 1 on test failure)
- `--verbose` - Show detailed output
- `--report` - Generate test reports in various formats
- `--provider` - Override default provider for this run
- `--threshold` - Override default threshold for this run

---

## 📊 Reporting

Generate detailed reports in multiple formats:

```bash
# Generate HTML report
tuneprompt run --report html

# Generate JSON report
tuneprompt run --report json

# Generate JUnit XML for CI integration
tuneprompt run --report junit
```

---

## 🔐 Privacy & Security

- All semantic comparisons happen locally using open-source embedding models
- Your prompts and expected outputs never leave your machine (unless using premium cloud features)
- API keys are only sent to the respective LLM providers
- Premium features offer optional cloud processing for faster results

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

---

## ⚖️ License

MIT © Tuneprompt. Premium features require a license key via `tuneprompt activate`.

For commercial use and enterprise support, contact us at [contact@tuneprompt.com](mailto:contact@tuneprompt.com).

---
