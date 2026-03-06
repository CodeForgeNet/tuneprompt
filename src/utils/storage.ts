import { TestDatabase } from '../storage/database';
import { FailedTest } from '../types/fix';
import { TestResult } from '../types';

export async function getFailedTests(): Promise<FailedTest[]> {
    const db = new TestDatabase();
    const recentRuns = db.getRecentRuns(1);

    if (recentRuns.length === 0) {
        return [];
    }

    const latestRun = recentRuns[0];
    const failures = latestRun.results.filter(r => r.status === 'fail' || r.status === 'error');

    return failures.map(mapResultToFailedTest);
}

/**
 * Get the full suite of tests (passing and failing) for a specific prompt file
 */
export async function getSuiteTests(filePath: string): Promise<FailedTest[]> {
    const db = new TestDatabase();
    const recentRuns = db.getRecentRuns(1);

    if (recentRuns.length === 0) {
        return [];
    }

    const latestRun = recentRuns[0];
    const suite = latestRun.results.filter(r => r.testCase.filePath === filePath);

    return suite.map(mapResultToFailedTest);
}

function mapResultToFailedTest(r: TestResult): FailedTest {
    return {
        id: r.testCase.filePath || r.id,
        description: r.testCase.description,
        prompt: !r.testCase.prompt ? '' : (typeof r.testCase.prompt === 'string' ? r.testCase.prompt : r.testCase.prompt.user),
        input: r.testCase.variables,
        expectedOutput: typeof r.testCase.expect === 'string' ? r.testCase.expect : JSON.stringify(r.testCase.expect),
        actualOutput: r.actualOutput || '',
        score: r.score,
        threshold: r.testCase.config?.threshold || 0.8,
        errorType: (r.testCase.config?.method as any) || 'semantic',
        errorMessage: r.error || '',
        config: {
            provider: r.metadata?.provider,
            model: r.testCase.config?.model || (r.testCase.config as any)?.modelId
        }
    };
}
