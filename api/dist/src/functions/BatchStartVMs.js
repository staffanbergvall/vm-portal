"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchStartVMs = BatchStartVMs;
/**
 * BatchStartVMs Function - Starts multiple VMs in parallel
 */
const functions_1 = require("@azure/functions");
const arm_compute_1 = require("@azure/arm-compute");
const azureAuth_1 = require("../utils/azureAuth");
// Validate VM name to prevent injection
function isValidVmName(name) {
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}
// Get user info from SWA headers for audit logging
function getUserInfo(request) {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}
async function BatchStartVMs(request, context) {
    const { userId, userEmail } = getUserInfo(request);
    // Parse request body
    let body;
    try {
        body = await request.json();
    }
    catch {
        return {
            status: 400,
            jsonBody: { error: 'Invalid JSON body' }
        };
    }
    // Validate vmNames array
    if (!body.vmNames || !Array.isArray(body.vmNames) || body.vmNames.length === 0) {
        return {
            status: 400,
            jsonBody: { error: 'vmNames must be a non-empty array' }
        };
    }
    // Limit batch size
    if (body.vmNames.length > 10) {
        return {
            status: 400,
            jsonBody: { error: 'Maximum 10 VMs per batch operation' }
        };
    }
    // Validate all VM names
    const invalidNames = body.vmNames.filter(name => !isValidVmName(name));
    if (invalidNames.length > 0) {
        return {
            status: 400,
            jsonBody: { error: `Invalid VM names: ${invalidNames.join(', ')}` }
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
    // Audit log
    context.log({
        action: 'BatchStartVMs',
        vmNames: body.vmNames,
        vmCount: body.vmNames.length,
        resourceGroup: azureAuth_1.VM_RESOURCE_GROUP,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });
    try {
        // Use Managed Identity for authentication
        const credential = (0, azureAuth_1.getAzureCredential)();
        const client = new arm_compute_1.ComputeManagementClient(credential, azureAuth_1.VM_SUBSCRIPTION_ID);
        context.log(`Starting ${body.vmNames.length} VMs in parallel: ${body.vmNames.join(', ')}`);
        // Start all VMs in parallel
        const results = await Promise.allSettled(body.vmNames.map(async (vmName) => {
            try {
                const poller = await client.virtualMachines.beginStart(azureAuth_1.VM_RESOURCE_GROUP, vmName);
                await poller.pollUntilDone();
                context.log(`VM ${vmName} started successfully`);
                return {
                    vmName,
                    success: true,
                    message: `VM ${vmName} started successfully`
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                context.error(`Failed to start VM ${vmName}: ${errorMessage}`);
                return {
                    vmName,
                    success: false,
                    message: errorMessage
                };
            }
        }));
        // Process results
        const vmResults = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
                return {
                    vmName: body.vmNames[index],
                    success: false,
                    message: result.reason?.message || 'Unknown error'
                };
            }
        });
        const successCount = vmResults.filter(r => r.success).length;
        const failureCount = vmResults.filter(r => !r.success).length;
        context.log(`BatchStartVMs completed: ${successCount} succeeded, ${failureCount} failed`);
        return {
            status: failureCount === body.vmNames.length ? 500 : 200,
            jsonBody: {
                success: failureCount === 0,
                message: `Started ${successCount}/${body.vmNames.length} VMs`,
                results: vmResults,
                resourceGroup: azureAuth_1.VM_RESOURCE_GROUP
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`BatchStartVMs error:`, errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to start VMs',
                message: errorMessage
            }
        };
    }
}
functions_1.app.http('BatchStartVMs', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'vms/batch/start',
    handler: BatchStartVMs
});
//# sourceMappingURL=BatchStartVMs.js.map