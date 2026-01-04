"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StopVM = StopVM;
/**
 * StopVM Function - Stops and deallocates a specific VM
 * Uses deallocate to stop compute charges
 */
const functions_1 = require("@azure/functions");
const arm_compute_1 = require("@azure/arm-compute");
const identity_1 = require("@azure/identity");
const VM_SUBSCRIPTION_ID = process.env.VM_SUBSCRIPTION_ID || '';
const VM_RESOURCE_GROUP = process.env.VM_RESOURCE_GROUP || '';
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
async function StopVM(request, context) {
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
    if (!VM_SUBSCRIPTION_ID || !VM_RESOURCE_GROUP) {
        context.error('Missing VM_SUBSCRIPTION_ID or VM_RESOURCE_GROUP configuration');
        return {
            status: 500,
            jsonBody: { error: 'Server configuration error' }
        };
    }
    try {
        // Audit log
        context.log({
            action: 'StopVM',
            vmName,
            resourceGroup: VM_RESOURCE_GROUP,
            userId,
            userEmail,
            timestamp: new Date().toISOString()
        });
        // Use Managed Identity for authentication
        const credential = new identity_1.DefaultAzureCredential();
        const client = new arm_compute_1.ComputeManagementClient(credential, VM_SUBSCRIPTION_ID);
        context.log(`Stopping and deallocating VM: ${vmName} in ${VM_RESOURCE_GROUP}`);
        // Deallocate the VM (stops and releases compute resources - no charges)
        const poller = await client.virtualMachines.beginDeallocate(VM_RESOURCE_GROUP, vmName);
        // Wait for completion
        await poller.pollUntilDone();
        context.log(`VM ${vmName} deallocated successfully by ${userEmail}`);
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `VM ${vmName} stopped and deallocated successfully`,
                vmName,
                resourceGroup: VM_RESOURCE_GROUP
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`StopVM error for ${vmName}:`, errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to stop VM',
                message: errorMessage,
                vmName
            }
        };
    }
}
functions_1.app.http('StopVM', {
    methods: ['POST'],
    authLevel: 'anonymous', // Auth handled by SWA
    route: 'vms/{vmName}/stop',
    handler: StopVM
});
//# sourceMappingURL=StopVM.js.map