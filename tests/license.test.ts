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
            'sub_test123',
            'test@example.com',
            'pro-monthly'
        );

        expect(success).toBe(true);

        const license = getLicenseInfo();
        expect(license).toBeTruthy();
        expect(license?.email).toBe('test@example.com');
    });

    it('should verify lifetime licenses without API call', async () => {
        await activateLicense('sub_lifetime', 'test@example.com', 'lifetime');

        const isValid = await checkLicense();
        expect(isValid).toBe(true);
    });
});