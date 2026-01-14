const { PostHog } = require('posthog-node');

const client = new PostHog(
    process.env.POSTHOG_KEY || 'phc_xxxxx',
    { host: 'https://app.posthog.com' }
);

export function trackEvent(
    userId: string,
    event: string,
    properties?: Record<string, any>
) {
    if (process.env.NODE_ENV === 'production') {
        client.capture({
            distinctId: userId,
            event,
            properties
        });
    }
}

// Track in fix command
export async function trackFixAttempt(
    userId: string,
    testCount: number,
    success: boolean
) {
    trackEvent(userId, 'fix_attempted', {
        test_count: testCount,
        success
    });
}