

export function cleanAndFormat(...args: string[]): string {
    return args
        .filter(arg => arg.trim() !== '')  // Remove empty or whitespace-only strings
        .map(arg => arg.trim())            // Trim spaces from each string
        .join(' ');                         // Join the cleaned parts with a single space
}