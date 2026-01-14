import chalk from 'chalk';

export class TunePromptError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'TunePromptError';
    }
}

export function handleError(error: any) {
    if (error instanceof TunePromptError) {
        console.error(chalk.red(`\n❌ Error [${error.code}]: ${error.message}\n`));
        if (error.details) {
            console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
        }
    } else {
        console.error(chalk.red('\n❌ Unexpected error:'), error.message);
    }

    process.exit(1);
}

// Common errors
export const Errors = {
    NO_LICENSE: new TunePromptError(
        'No active license found',
        'NO_LICENSE',
        { suggestion: 'Run: tuneprompt activate <subscription-id>' }
    ),

    INVALID_LICENSE: new TunePromptError(
        'License validation failed',
        'INVALID_LICENSE',
        { suggestion: 'Your subscription may have expired or been cancelled' }
    ),

    API_KEY_MISSING: new TunePromptError(
        'API key not configured',
        'API_KEY_MISSING',
        { suggestion: 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment' }
    ),

    NO_FAILED_TESTS: new TunePromptError(
        'No failed tests found to fix',
        'NO_FAILED_TESTS',
        { suggestion: 'Run: tuneprompt run first' }
    ),

    NETWORK_ERROR: new TunePromptError(
        'Network request failed',
        'NETWORK_ERROR',
        { suggestion: 'Check your internet connection and try again' }
    ),

    OPTIMIZATION_FAILED: new TunePromptError(
        'Failed to generate prompt optimization',
        'OPTIMIZATION_FAILED',
        { suggestion: 'The AI service may be temporarily unavailable' }
    )
};