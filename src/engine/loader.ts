import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TestCase } from '../types';

export class TestLoader {
    loadTestFile(filePath: string): TestCase[] {
        const ext = path.extname(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');

        if (ext === '.json') {
            const data = JSON.parse(content);
            return Array.isArray(data) ? data : [data];
        } else if (ext === '.yaml' || ext === '.yml') {
            const data = yaml.load(content) as any;
            return Array.isArray(data) ? data : [data];
        } else {
            throw new Error(`Unsupported file format: ${ext}`);
        }
    }

    loadTestDir(dirPath: string): TestCase[] {
        const tests: TestCase[] = [];
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                tests.push(...this.loadTestDir(filePath));
            } else if (file.match(/\.(json|ya?ml)$/)) {
                tests.push(...this.loadTestFile(filePath));
            }
        }

        return tests;
    }
}