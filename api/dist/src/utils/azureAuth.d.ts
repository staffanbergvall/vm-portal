/**
 * Azure Authentication Utility
 *
 * Static Web Apps managed functions don't support DefaultAzureCredential (no IMDS endpoint).
 * Use Service Principal authentication instead.
 */
import { ClientSecretCredential } from '@azure/identity';
export declare const VM_SUBSCRIPTION_ID: string;
export declare const VM_RESOURCE_GROUP: string;
export declare const AUTOMATION_ACCOUNT_NAME: string;
/**
 * Creates an Azure credential for API calls
 * Uses Service Principal authentication since Static Web Apps managed functions
 * don't have access to IMDS endpoint for Managed Identity
 */
export declare function getAzureCredential(): ClientSecretCredential;
/**
 * Validates that all required configuration is present
 */
export declare function validateConfiguration(): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=azureAuth.d.ts.map