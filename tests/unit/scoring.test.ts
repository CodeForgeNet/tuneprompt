import { exactMatch } from '../../src/scoring/exact-match';
import { validateJSON } from '../../src/scoring/json-validator';

describe('Exact Match Scoring', () => {
    it('should return 1.0 for exact matches', () => {
        expect(exactMatch('hello', 'hello')).toBe(1.0);
    });

    it('should be case-insensitive', () => {
        expect(exactMatch('Hello', 'hello')).toBe(1.0);
    });

    it('should trim whitespace', () => {
        expect(exactMatch('  hello  ', 'hello')).toBe(1.0);
    });

    it('should return 0.0 for non-matches', () => {
        expect(exactMatch('hello', 'goodbye')).toBe(0.0);
    });
});

describe('JSON Validation', () => {
    it('should validate matching JSON structure', () => {
        const expected = { name: 'Alice', age: 30 };
        const actual = JSON.stringify({ name: 'Alice', age: 30 });

        const result = validateJSON(expected, actual);
        expect(result.score).toBe(1.0);
    });

    it('should fail for invalid JSON', () => {
        const expected = { name: 'Alice' };
        const actual = 'not valid json';

        const result = validateJSON(expected, actual);
        expect(result.score).toBe(0.0);
        expect(result.error).toBeDefined();
    });

    it('should fail for mismatched structure', () => {
        const expected = { name: 'Alice', age: 30 };
        const actual = JSON.stringify({ name: 'Alice' });

        const result = validateJSON(expected, actual);
        expect(result.score).toBe(0.0);
    });
});