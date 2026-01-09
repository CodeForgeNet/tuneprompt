import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { TestRun, TestResult } from '../types';

export class TestDatabase {
    private db: Database.Database;

    constructor(dbPath?: string) {
        const defaultPath = path.join(os.homedir(), '.tuneprompt', 'history.db');
        const dir = path.dirname(dbPath || defaultPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath || defaultPath);
        this.migrate();
    }

    private migrate() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        total_tests INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        failed INTEGER NOT NULL,
        duration INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS test_results (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        score REAL NOT NULL,
        actual_output TEXT,
        expected_output TEXT,
        error TEXT,
        duration INTEGER NOT NULL,
        tokens INTEGER,
        cost REAL,
        FOREIGN KEY (run_id) REFERENCES test_runs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_run_timestamp ON test_runs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_result_run ON test_results(run_id);
    `);
    }

    saveRun(run: TestRun): void {
        const insertRun = this.db.prepare(`
      INSERT INTO test_runs (id, timestamp, total_tests, passed, failed, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        insertRun.run(
            run.id,
            run.timestamp.getTime(),
            run.totalTests,
            run.passed,
            run.failed,
            run.duration
        );

        const insertResult = this.db.prepare(`
      INSERT INTO test_results 
      (id, run_id, description, status, score, actual_output, expected_output, error, duration, tokens, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        for (const result of run.results) {
            insertResult.run(
                result.id,
                run.id,
                result.testCase.description,
                result.status,
                result.score,
                result.actualOutput,
                result.expectedOutput,
                result.error || null,
                result.metadata.duration,
                result.metadata.tokens || null,
                result.metadata.cost || null
            );
        }
    }

    getRecentRuns(limit: number = 10): TestRun[] {
        const runs = this.db.prepare(`
      SELECT * FROM test_runs 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit) as any[];

        return runs.map(run => ({
            id: run.id,
            timestamp: new Date(run.timestamp),
            totalTests: run.total_tests,
            passed: run.passed,
            failed: run.failed,
            duration: run.duration,
            results: this.getRunResults(run.id)
        }));
    }

    private getRunResults(runId: string): TestResult[] {
        const results = this.db.prepare(`
      SELECT * FROM test_results WHERE run_id = ?
    `).all(runId) as any[];

        return results.map(r => ({
            id: r.id,
            testCase: { description: r.description } as any,
            status: r.status,
            score: r.score,
            actualOutput: r.actual_output,
            expectedOutput: r.expected_output,
            error: r.error,
            metadata: {
                duration: r.duration,
                timestamp: new Date(),
                tokens: r.tokens,
                cost: r.cost
            }
        }));
    }

    close(): void {
        this.db.close();
    }
}