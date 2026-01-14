import { TestDatabase } from '../storage/database';
import { FailedTest } from '../types/fix';

export async function getFailedTests(): Promise<FailedTest[]> {
    const db = new TestDatabase();
    const recentRuns = db.getRecentRuns(1);

    if (recentRuns.length === 0) {
        return [];
    }

    const latestRun = recentRuns[0];
    const failures = latestRun.results.filter(r => r.status === 'fail' || r.status === 'error');

    return failures.map(r => ({
        id: r.testCase.filePath || r.id, // Prefer filePath for targeting the correct file
        description: r.testCase.description,
        prompt: !r.testCase.prompt ? '' : (typeof r.testCase.prompt === 'string' ? r.testCase.prompt : r.testCase.prompt.user),
        input: r.testCase.variables,
        expectedOutput: typeof r.testCase.expect === 'string' ? r.testCase.expect : JSON.stringify(r.testCase.expect),
        actualOutput: r.actualOutput,
        score: r.score,
        threshold: r.testCase.config?.threshold || 0.8,
        errorType: (r.testCase.config?.method as any) || 'semantic',
        errorMessage: r.error || ''
    }));
}
