import chalk from 'chalk';
import Table from 'cli-table3';
import { TestDatabase } from '../storage/database';

export interface HistoryOptions {
    limit?: number;
    detailed?: boolean;
}

export async function historyCommand(options: HistoryOptions) {
    const db = new TestDatabase();
    const runs = db.getRecentRuns(options.limit || 10);
    db.close();

    if (runs.length === 0) {
        console.log(chalk.yellow('No test history found. Run some tests first!'));
        return;
    }

    console.log(chalk.bold('\n📊 Test History\n'));

    const table = new Table({
        head: ['Date', 'Total', 'Passed', 'Failed', 'Duration', 'Pass Rate'],
        colWidths: [20, 8, 10, 10, 12, 12]
    });

    for (const run of runs) {
        const passRate = ((run.passed / run.totalTests) * 100).toFixed(1);
        const passRateColor = parseFloat(passRate) >= 80
            ? chalk.green
            : parseFloat(passRate) >= 50
                ? chalk.yellow
                : chalk.red;

        table.push([
            run.timestamp.toLocaleString(),
            run.totalTests,
            chalk.green(run.passed),
            chalk.red(run.failed),
            `${run.duration}ms`,
            passRateColor(`${passRate}%`)
        ]);
    }

    console.log(table.toString());

    if (options.detailed) {
        console.log(chalk.bold('\n📝 Detailed Results\n'));

        for (const run of runs) {
            console.log(chalk.dim(`\nRun: ${run.id}`));
            console.log(chalk.dim(`Date: ${run.timestamp.toLocaleString()}\n`));

            const detailTable = new Table({
                head: ['Status', 'Test', 'Score'],
                colWidths: [10, 50, 10]
            });

            for (const result of run.results) {
                const status = result.status === 'pass'
                    ? chalk.green('✓')
                    : chalk.red('✗');

                detailTable.push([
                    status,
                    result.testCase.description,
                    result.score.toFixed(2)
                ]);
            }

            console.log(detailTable.toString());
        }
    }

    console.log();
}