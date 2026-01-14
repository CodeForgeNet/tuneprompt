import { FailedTest } from '../types/fix';

export interface ExtractedConstraints {
    errorType: 'semantic' | 'json' | 'exact' | 'length' | 'format';
    issues: string[];
    suggestions: string[];
}

export function extractConstraints(test: FailedTest): ExtractedConstraints {
    const constraints: ExtractedConstraints = {
        errorType: test.errorType,
        issues: [],
        suggestions: []
    };

    // JSON validation failures
    if (test.errorType === 'json') {
        constraints.issues.push('Output was not valid JSON');

        try {
            JSON.parse(test.actualOutput);
        } catch (e: any) {
            constraints.issues.push(`JSON Error: ${e.message}`);
        }

        constraints.suggestions.push(
            'Add explicit JSON formatting instructions',
            'Provide a JSON schema example',
            'Use delimiters like <json_output></json_output>'
        );
    }

    // Semantic similarity failures
    if (test.errorType === 'semantic') {
        const scoreDiff = test.threshold - test.score;
        constraints.issues.push(
            `Semantic similarity too low (${test.score.toFixed(2)} < ${test.threshold})`
        );

        if (scoreDiff > 0.3) {
            constraints.issues.push('Output is significantly off-topic');
            constraints.suggestions.push(
                'Add more specific instructions',
                'Include key phrases that must appear',
                'Provide examples of correct outputs'
            );
        } else {
            constraints.issues.push('Output is close but missing key details');
            constraints.suggestions.push(
                'Emphasize critical information',
                'Add constraint checklist',
                'Request step-by-step reasoning'
            );
        }
    }

    // Length failures
    if (test.errorType === 'length') {
        const actualLength = test.actualOutput.length;
        constraints.issues.push(`Output length mismatch: ${actualLength} characters`);
        constraints.suggestions.push(
            'Specify exact character/word limits',
            'Add "Be concise" or "Be detailed" instructions',
            'Provide length reference examples'
        );
    }

    return constraints;
}

export function generateErrorContext(test: FailedTest): string {
    const constraints = extractConstraints(test);

    return `
Error Type: ${constraints.errorType.toUpperCase()}

Issues Detected:
${constraints.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Recommended Fixes:
${constraints.suggestions.map((sug, i) => `${i + 1}. ${sug}`).join('\n')}
`.trim();
}