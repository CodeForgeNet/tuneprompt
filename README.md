# tuneprompt 🎛️

**Stop guessing. Start measuring. Automate your prompt engineering.**

`tuneprompt` is a local-first CLI framework that treats prompts like unit tests. It moves LLM evaluation from "vibes" to deterministic and semantic scoring, directly inside your CI/CD pipeline.

---

## ⚡ The Problem

LLMs are non-deterministic. Traditional "Exact Match" testing fails because a model might be 100% correct but use different wording.

## 🚀 The Solution

`tuneprompt` uses **Semantic Similarity** (embeddings) to score responses based on intent and meaning, not just strings. If your prompt changes cause a regression, your build fails.

### Key Features

* **Semantic Scoring (FREE):** Uses local embeddings to verify output meaning against expectations.
* **CI/CD Native:** Drops into GitHub Actions or GitLab CI to block regressions.
* **Watch Mode:** Iterate on prompts in real-time with instant feedback.
* **Auto-Fix (Premium):** Don't just find errors—fix them. Our engine rewrites failing prompts automatically.

---

## 📦 Installation

```bash
npm install -g tuneprompt

```

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
      - name: Install & Test
        run: |
          npm install -g tuneprompt
          tuneprompt run --ci

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

`tuneprompt` supports OpenAI, Anthropic, and OpenRouter out of the box.

```javascript
// tuneprompt.config.js
module.exports = {
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o' },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY, model: 'claude-3-5-sonnet' }
  },
  threshold: 0.8 // Default semantic similarity
};

```

---

## ⚖️ License

MIT © Tuneprompt. Premium features require a license key via `tuneprompt activate`.

---
