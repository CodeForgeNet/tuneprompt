import axios from 'axios';
import { loadLicense } from '../utils/license';

export interface RunData {
    project_id: string;
    commit_hash?: string;
    branch_name?: string;
    commit_message?: string;
    environment: 'local' | 'ci' | 'production';
    ci_provider?: string;
    total_tests: number;
    passed_tests: number;
    failed_tests: number;
    duration_ms: number;
    cost_usd: number;
    started_at: string;
    completed_at: string;
    test_results: TestResult[];
}

export interface TestResult {
    test_name: string;
    test_description?: string;
    prompt: string;
    input_data?: any;
    expected_output: string;
    actual_output: string;
    score?: number;
    method: string;
    status: 'pass' | 'fail' | 'error';
    model: string;
    tokens_used?: number;
    latency_ms?: number;
    cost_usd?: number;
    error_message?: string;
    error_type?: string;
}

export class CloudService {
    private backendUrl: string;
    private subscriptionId?: string;

    constructor() {
        this.backendUrl = process.env.TUNEPROMPT_API_URL || process.env.BACKEND_URL || 'http://localhost:3000';
    }

    async init() {
        // Load subscription ID from local storage (Phase 2 activation)
        this.subscriptionId = await this.getSubscriptionId();
    }

    private async getSubscriptionId(): Promise<string | undefined> {
        const license = loadLicense();
        return license?.subscriptionId;
    }

    async uploadRun(data: RunData): Promise<{ success: boolean; run_id?: string; url?: string; error?: string }> {
        if (!this.subscriptionId) {
            return { success: false, error: 'Not activated. Run `tuneprompt activate` first.' };
        }

        try {
            const response = await axios.post(
                `${this.backendUrl}/api/cloud/ingest-run`,
                data,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-subscription-id': this.subscriptionId,
                    },
                    timeout: 30000,
                }
            );

            return response.data;
        } catch (error: any) {
            console.error('Failed to upload run:', error.message);
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    async createProject(name: string, description?: string): Promise<any> {
        if (!this.subscriptionId) {
            throw new Error('Not activated');
        }

        try {
            const response = await axios.post(
                `${this.backendUrl}/api/cloud/projects`,
                { name, description },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-subscription-id': this.subscriptionId,
                    },
                }
            );

            return response.data.project;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || error.message);
        }
    }

    async getProjects(): Promise<any[]> {
        if (!this.subscriptionId) {
            return [];
        }

        try {
            const response = await axios.get(
                `${this.backendUrl}/api/cloud/projects`,
                {
                    headers: {
                        'x-subscription-id': this.subscriptionId,
                    },
                }
            );

            return response.data.projects || [];
        } catch (error) {
            return [];
        }
    }

    async isAuthenticated(): Promise<boolean> {
        return !!this.subscriptionId;
    }
}