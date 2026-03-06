import { CustomProvider } from '../custom';

describe('CustomProvider', () => {
    it('should instantiate custom provider with arbitrary endpoint', () => {
        const provider = new CustomProvider({ endpoint: 'http://localhost:11434/api/generate' });
        expect(provider.endpoint).toBe('http://localhost:11434/api/generate');
    });
});
