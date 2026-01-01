/**
 * RestartVM Function - Restarts a specific VM
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ComputeManagementClient } from '@azure/arm-compute';
import { DefaultAzureCredential } from '@azure/identity';

const VM_SUBSCRIPTION_ID = process.env.VM_SUBSCRIPTION_ID || '';
const VM_RESOURCE_GROUP = process.env.VM_RESOURCE_GROUP || '';

// Validate VM name to prevent injection
function isValidVmName(name: string): boolean {
    // Azure VM names: 1-64 chars, alphanumeric, hyphens, underscores
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}

// Get user info from SWA headers for audit logging
function getUserInfo(request: HttpRequest): { userId: string; userEmail: string } {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}

export async function RestartVM(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
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
            action: 'RestartVM',
            vmName,
            resourceGroup: VM_RESOURCE_GROUP,
            userId,
            userEmail,
            timestamp: new Date().toISOString()
        });

        // Use Managed Identity for authentication
        const credential = new DefaultAzureCredential();
        const client = new ComputeManagementClient(credential, VM_SUBSCRIPTION_ID);

        context.log(`Restarting VM: ${vmName} in ${VM_RESOURCE_GROUP}`);

        // Restart the VM (async operation)
        const poller = await client.virtualMachines.beginRestart(VM_RESOURCE_GROUP, vmName);

        // Wait for completion
        await poller.pollUntilDone();

        context.log(`VM ${vmName} restarted successfully by ${userEmail}`);

        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `VM ${vmName} restarted successfully`,
                vmName,
                resourceGroup: VM_RESOURCE_GROUP
            }
        };
    } catch (error: unknown) {
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

app.http('RestartVM', {
    methods: ['POST'],
    authLevel: 'anonymous', // Auth handled by SWA
    route: 'vms/{vmName}/restart',
    handler: RestartVM
});
