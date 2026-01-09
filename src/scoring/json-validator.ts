export function validateJSON(expected: any, actual: string): { score: number; error?: string } {
    try {
        const parsed = JSON.parse(actual);

        // Check if structure matches
        const matches = deepCompare(expected, parsed);

        return { score: matches ? 1.0 : 0.0 };
    } catch (error: any) {
        return {
            score: 0.0,
            error: `Invalid JSON: ${error.message}`
        };
    }
}

function deepCompare(expected: any, actual: any): boolean {
    if (typeof expected !== typeof actual) return false;

    if (typeof expected === 'object' && expected !== null) {
        const expectedKeys = Object.keys(expected);
        const actualKeys = Object.keys(actual);

        if (expectedKeys.length !== actualKeys.length) return false;

        return expectedKeys.every(key =>
            actualKeys.includes(key) && deepCompare(expected[key], actual[key])
        );
    }

    return expected === actual;
}