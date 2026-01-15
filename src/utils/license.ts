import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import axios from 'axios';

interface LicenseData {
    subscriptionId: string;
    email: string;
    plan: 'pro-monthly' | 'pro-yearly' | 'lifetime';
    activatedAt: string;
    lastVerified: string;
    instanceId: string;
}

const LICENSE_DIR = path.join(os.homedir(), '.tuneprompt');
const LICENSE_FILE = path.join(LICENSE_DIR, 'license.json');
const VERIFICATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Ensure license directory exists
 */
function ensureLicenseDir() {
    if (!fs.existsSync(LICENSE_DIR)) {
        fs.mkdirSync(LICENSE_DIR, { recursive: true });
    }
}

/**
 * Generate a unique machine ID
 */
function generateInstanceId(): string {
    const hostname = os.hostname();
    const username = os.userInfo().username;
    const hash = crypto
        .createHash('sha256')
        .update(`${hostname}-${username}`)
        .digest('hex')
        .substring(0, 16);

    return hash;
}

/**
 * Save license data locally
 */
export function saveLicense(data: LicenseData) {
    ensureLicenseDir();

    const encrypted = Buffer.from(JSON.stringify(data)).toString('base64');
    fs.writeFileSync(LICENSE_FILE, encrypted, 'utf-8');
}

/**
 * Load license data from disk
 */
export function loadLicense(): LicenseData | null {
    if (!fs.existsSync(LICENSE_FILE)) {
        return null
    }

    try {
        const encrypted = fs.readFileSync(LICENSE_FILE, 'utf-8');
        const decrypted = Buffer.from(encrypted, 'base64').toString('utf-8');
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Failed to load license:', error);
        return null;
    }
}

/**
 * Delete license from disk
 */
export function deleteLicense() {
    if (fs.existsSync(LICENSE_FILE)) {
        fs.unlinkSync(LICENSE_FILE);
    }
}

/**
 * Check if license needs verification (24h since last check)
 */
function needsVerification(license: LicenseData): boolean {
    const lastVerified = new Date(license.lastVerified).getTime();
    const now = Date.now();

    return (now - lastVerified) > VERIFICATION_INTERVAL;
}

/**
 * Verify license with backend API
 */
async function verifyWithBackend(subscriptionId: string): Promise<boolean> {
    try {
        // Call your backend API (we'll create this in Week 3)
        const response = await axios.post(
            `${process.env.TUNEPROMPT_API_URL || 'https://api.tuneprompt.com'}/api/verify-license`,
            {
                subscriptionId
            },
            {
                timeout: 5000
            }
        );

        return response.data.valid === true;
    } catch (error: any) {
        // Fail open: if API is down, allow access for paid users
        console.warn('License verification failed (network issue), allowing access');
        return true;
    }
}

/**
 * Main license check function
 * Always verifies with backend to ensure real-time status
 */
export async function checkLicense(): Promise<boolean> {
    const license = loadLicense();

    if (!license) {
        return false; // No license found
    }

    // Lifetime licenses don't need verification
    if (license.plan === 'lifetime') {
        return true;
    }

    // Always verify with backend to get real-time status
    const isValid = await verifyWithBackend(license.subscriptionId);

    if (isValid) {
        // Update last verified timestamp
        license.lastVerified = new Date().toISOString();
        saveLicense(license);
        return true;
    } else {
        // License is invalid (expired/cancelled)
        deleteLicense();
        return false;
    }
}

/**
 * Activate a new license
 */
export async function activateLicense(
    subscriptionId: string,
    email: string,
    plan: 'pro-monthly' | 'pro-yearly' | 'lifetime'
): Promise<boolean> {
    try {
        // Verify the subscription is valid
        const isValid = await verifyWithBackend(subscriptionId);

        if (!isValid) {
            return false;
        }

        const licenseData: LicenseData = {
            subscriptionId,
            email,
            plan,
            activatedAt: new Date().toISOString(),
            lastVerified: new Date().toISOString(),
            instanceId: generateInstanceId()
        };

        saveLicense(licenseData);
        return true;

    } catch (error) {
        console.error('License activation failed:', error);
        return false;
    }
}

/**
 * Get current license info
 */
export function getLicenseInfo(): LicenseData | null {
    return loadLicense();
}
/**
 * License Manager for checking features
 */
export class LicenseManager {
    async hasFeature(feature: string): Promise<boolean> {
        const isValid = await checkLicense();
        if (!isValid) return false;

        // Currently all features are available with any valid license
        // In the future, we can add plan-specific logic here
        return true;
    }
}
