export type Step = { prompt: string; expect: string };
export type TestConfig = {
    prompt?: string;
    steps?: Step[];
};
