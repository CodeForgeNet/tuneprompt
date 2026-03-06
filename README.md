# TunePrompt

[![npm version](https://img.shields.io/npm/v/tuneprompt.svg?style=flat-square)](https://www.npmjs.com/package/tuneprompt)
[![npm downloads](https://img.shields.io/npm/dm/tuneprompt.svg?style=flat-square)](https://www.npmjs.com/package/tuneprompt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Industrial-grade testing framework for LLM prompts

## Overview

TunePrompt is a comprehensive testing framework designed specifically for Large Language Model (LLM) prompts. It helps developers validate, test, and optimize their prompts with industrial-grade reliability and accuracy.

## 🚀 What's New in v1.1.1

The first production-ready release of **TunePrompt**, the industrial-grade testing framework for the modern LLM stack.

- **Multi-Provider Support**: Seamlessly test across **OpenAI**, **Anthropic**, **Gemini**, and **OpenRouter**.
- **Semantic Evaluation**: Advanced vector-based scoring to detect logic drift and nuance shifts.
- **Auto-Fix Engine (Premium)**: AI-powered prompt optimization for failing tests.
- **Cloud Orchestration**: Unified synchronization with the [TunePrompt Dashboard](https://www.tuneprompt.xyz).
- **Industrial CLI**: Built-in watch mode, CI/CD integration, and historical analytics.

## Features

- **Multi-provider Support**: Native integration with Google Gemini, OpenAI, Anthropic, and OpenRouter.
- **Semantic Testing**: Compare outputs using high-precision embedding similarity.
- **JSON Validation**: Validate structured outputs with schema-aware checks.
- **LLM-based Judging**: Utilize advanced providers as evaluators for qualitative metrics.
- **Watch Mode**: Immediate feedback loop with automatic re-runs on file changes.
- **CI/CD Ready**: Native integration patterns for industrial deployment pipelines.
- **Cloud Sync**: Global telemetry and result storage via the dashboard.
- **Auto-fix Engine**: Iterative refinement loop for intelligent prompt repair.

## Installation

```bash
npm install -g tuneprompt
```

## Quick Start

1. Initialize a new project:
```bash
tuneprompt init
```

2. Create test files in the `tests` directory with your prompts and expectations

3. Run tests:
```bash
tuneprompt run
```

4. Run tests with cloud sync (requires activation):
```bash
tuneprompt run --cloud
```

## Commands

- `tuneprompt init`: Initialize a new TunePrompt project
- `tuneprompt run`: Run prompt tests
- `tuneprompt run --watch`: Run tests in watch mode
- `tuneprompt run --cloud`: Run tests and upload results to cloud
- `tuneprompt run --ci`: Run tests in CI mode
- `tuneprompt fix`: Auto-fix failing prompts (Premium feature)
- `tuneprompt history`: View test run history
- `tuneprompt activate [subscription-id]`: Activate your Premium license
- `tuneprompt status`: Check license status

## Configuration

TunePrompt uses a configuration file to define providers and settings. The default location is `tuneprompt.config.js` in your project root.

Example configuration:
```javascript
module.exports = {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-opus-20240229',
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'openai/gpt-4o',
    }
  },
  threshold: 0.85,
  testDir: './tests',
  outputFormat: 'table'
};
```

## Test File Format

Tests are defined in JSON files in the `tests` directory. Each test file contains an array of test cases:

```json
[
  {
    "description": "User onboarding welcome message",
    "prompt": "Generate a friendly welcome message for a user named {{name}}.",
    "variables": {
      "name": "Alice"
    },
    "expect": "Welcome, Alice! We are glad you are here.",
    "config": {
      "threshold": 0.85,
      "method": "semantic",
      "model": "gpt-4o",
      "provider": "openai"
    }
  }
]
```

## Testing Methods

- `exact`: Exact string match
- `semantic`: Semantic similarity comparison
- `json`: JSON structure validation
- `llm-judge`: LLM-based evaluation

## Cloud Integration

TunePrompt offers cloud synchronization for storing test results and viewing them in a dashboard. To use cloud features:

1. Purchase a subscription at [https://www.tuneprompt.xyz](https://www.tuneprompt.xyz)
2. Activate your license:
```bash
tuneprompt activate [your-subscription-id]
```
3. Run tests with cloud sync:
```bash
tuneprompt run --cloud
```

## Premium Features

- **Auto-fix Engine**: Automatically repair failing prompts using AI
- **Cloud sync & team collaboration**: Store results in the cloud and collaborate with your team
- **Advanced diagnostics**: Detailed insights and recommendations

## Environment Variables

Create a `.env` file in your project root with your API keys:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT