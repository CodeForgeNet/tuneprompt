import { describe, it, expect, beforeEach } from '@jest/globals';
import { activateLicense, checkLicense, getLicenseInfo, deleteLicense } from '../src/utils/license';

describe('License Management', () => {
    beforeEach(() => {
        deleteLicense(); // Clean state
    });

    it('should return false when no license exists', async () => {
        const isValid = await checkLicense();
        expect(isValid).toBe(false);
    });

    it('should activate and store license', async () => {
        const success = await activateLicense(
            'sub_test123'
        );

        expect(success).toBe(true);

        const license = getLicenseInfo();
        expect(license).toBeTruthy();
        // Since verifyWithBackend fails in tests (no real API), it falls back to unknown@user.com
        expect(['test@example.com', 'unknown@user.com']).toContain(license?.email);
    });

    it('should verify lifetime licenses without API call', async () => {
        await activateLicense('sub_lifetime');

        const isValid = await checkLicense();
        expect(isValid).toBe(true);
    });
});