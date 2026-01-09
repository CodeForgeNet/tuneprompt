export function exactMatch(expected: string, actual: string): number {
    const normalizedExpected = expected.trim().toLowerCase();
    const normalizedActual = actual.trim().toLowerCase();

    return normalizedExpected === normalizedActual ? 1.0 : 0.0;
}