/**
 * Interpolate variables in a prompt string using {{variableName}} syntax
 */
export function interpolateVariables(
    prompt: string,
    variables?: Record<string, any>
): string {
    if (!variables) return prompt;

    let result = prompt;
    for (const [key, value] of Object.entries(variables)) {
        // Use a global regex to replace all occurrences
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
}
