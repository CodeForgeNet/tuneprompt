import chalk from 'chalk';
import Table from 'cli-table3';
import { TestRun, TestResult } from '../types';

export class TestReporter {
    printResults(run: TestRun, format: 'json' | 'table' | 'both' = 'both') {
        if (format === 'json' || format === 'both') {
            this.printJSON(run);
        }

        if (format === 'table' || format === 'both') {
            this.printTable(run);
        }

        this.printSummary(run);
    }

    private printJSON(run: TestRun) {
        console.log(JSON.stringify(run, null, 2));
    }

    private printTable(run: TestRun) {
        const table = new Table({
            head: ['Status', 'Test', 'Score', 'Method', 'Duration'],
            colWidths: [10, 40, 10, 15, 12]
        });

        for (const result of run.results) {
            const statusIcon = result.status === 'pass'
                ? chalk.green('✓ PASS')
                : result.status === 'fail'
                    ? chalk.red('✗ FAIL')
                    : chalk.yellow('⚠ ERROR');

            const scoreColor = result.score >= 0.8
                ? chalk.green
                : result.score >= 0.5
                    ? chalk.yellow
                    : chalk.red;

            table.push([
                statusIcon,
                result.testCase.description,
                scoreColor(result.score.toFixed(2)),
                result.testCase.config?.method || 'semantic',
                `${result.metadata.duration}ms`
            ]);
        }

        console.log(table.toString());
    }

    private printSummary(run: TestRun) {
        console.log('\n' + chalk.bold('Summary:'));
        console.log(`  Total: ${run.totalTests}`);
        console.log(chalk.green(`  Passed: ${run.passed}`));
        console.log(chalk.red(`  Failed: ${run.failed}`));
        console.log(`  Duration: ${run.duration}ms`);

        const totalCost = run.results.reduce(
            (sum, r) => sum + (r.metadata.cost || 0),
            0
        );
        console.log(`  Cost: $${totalCost.toFixed(4)}`);
    }
}