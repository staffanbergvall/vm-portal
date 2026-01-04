/**
 * Azure Authentication Utility
 *
 * Static Web Apps managed functions don't support DefaultAzureCredential (no IMDS endpoint).
 * Use Service Principal authentication instead.
 */
import { ClientSecretCredential } from '@azure/identity';

const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || 'a0341c1a-9478-43a9-9d3d-86fa5910acc7';
const AZURE_CLIENT_ID = process.env.ENTRA_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.ENTRA_CLIENT_SECRET || '';

export const VM_SUBSCRIPTION_ID = process.env.VM_SUBSCRIPTION_ID || '';
export const VM_RESOURCE_GROUP = process.env.VM_RESOURCE_GROUP || '';
export const AUTOMATION_ACCOUNT_NAME = process.env.AUTOMATION_ACCOUNT_NAME || 'aa-vmportalprod-72pgwzfl';

/**
 * Creates an Azure credential for API calls
 * Uses Service Principal authentication since Static Web Apps managed functions
 * don't have access to IMDS endpoint for Managed Identity
 */
export function getAzureCredential(): ClientSecretCredential {
    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
        throw new Error('Missing ENTRA_CLIENT_ID or ENTRA_CLIENT_SECRET in application settings');
    }

    return new ClientSecretCredential(
        AZURE_TENANT_ID,
        AZURE_CLIENT_ID,
        AZURE_CLIENT_SECRET
    );
}

/**
 * Validates that all required configuration is present
 */
export function validateConfiguration(): { valid: boolean; error?: string } {
    if (!VM_SUBSCRIPTION_ID || !VM_RESOURCE_GROUP) {
        return {
            valid: false,
            error: 'Missing VM_SUBSCRIPTION_ID or VM_RESOURCE_GROUP configuration'
        };
    }

    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
        return {
            valid: false,
            error: 'Missing ENTRA_CLIENT_ID or ENTRA_CLIENT_SECRET configuration'
        };
    }

    return { valid: true };
}
