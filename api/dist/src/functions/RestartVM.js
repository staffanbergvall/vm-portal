"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestartVM = RestartVM;
/**
 * RestartVM Function - Restarts a specific VM
 */
const functions_1 = require("@azure/functions");
const arm_compute_1 = require("@azure/arm-compute");
const azureAuth_1 = require("../utils/azureAuth");
// Validate VM name to prevent injection
function isValidVmName(name) {
    // Azure VM names: 1-64 chars, alphanumeric, hyphens, underscores
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}
// Get user info from SWA headers for audit logging
function getUserInfo(request) {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}
async function RestartVM(request, context) {
    const vmName = request.params.vmName;
    const { userId, userEmail } = getUserInfo(request);
    // Validate VM name
    if (!vmName || !isValidVmName(vmName)) {
        context.warn(`Invalid VM name: ${vmName}`);
        return {
            status: 400,
            jsonBody: { error: 'Invalid VM name' }
        };
    }
    // Validate configuration
    if (!azureAuth_1.VM_SUBSCRIPTION_ID || !azureAuth_1.VM_RESOURCE_GROUP) {
        context.error('Missing VM_SUBSCRIPTION_ID or VM_RESOURCE_GROUP configuration');
        return {
            status: 500,
            jsonBody: { error: 'Server configuration error' }
        };
    }
    try {
        // Audit log
        context.log({
            action: 'RestartVM',
            vmName,
            resourceGroup: azureAuth_1.VM_RESOURCE_GROUP,
            userId,
            userEmail,
            timestamp: new Date().toISOString()
        });
        // Use Managed Identity for authentication
        const credential = (0, azureAuth_1.getAzureCredential)();
        const client = new arm_compute_1.ComputeManagementClient(credential, azureAuth_1.VM_SUBSCRIPTION_ID);
        context.log(`Restarting VM: ${vmName} in ${azureAuth_1.VM_RESOURCE_GROUP}`);
        // Restart the VM (async operation)
        const poller = await client.virtualMachines.beginRestart(azureAuth_1.VM_RESOURCE_GROUP, vmName);
        // Wait for completion
        await poller.pollUntilDone();
        context.log(`VM ${vmName} restarted successfully by ${userEmail}`);
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `VM ${vmName} restarted successfully`,
                vmName,
                resourceGroup: azureAuth_1.VM_RESOURCE_GROUP
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`RestartVM error for ${vmName}:`, errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to restart VM',
                message: errorMessage,
                vmName
            }
        };
    }
}
functions_1.app.http('RestartVM', {
    methods: ['POST'],
    authLevel: 'anonymous', // Auth handled by SWA
    route: 'vms/{vmName}/restart',
    handler: RestartVM
});
//# sourceMappingURL=RestartVM.js.map