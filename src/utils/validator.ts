import { TestConfig } from '../types/test';

export function validateTestFile(configs: TestConfig[]) {
    for (const config of configs) {
        if (!config.prompt && (!config.steps || config.steps.length === 0)) {
            throw new Error("Invalid configuration: missing required 'prompt' field");
        }
    }
}
