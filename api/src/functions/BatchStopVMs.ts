/**
 * BatchStopVMs Function - Stops and deallocates multiple VMs in parallel
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ComputeManagementClient } from '@azure/arm-compute';
import { getAzureCredential, VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP, validateConfiguration } from '../utils/azureAuth';


interface BatchStopRequest {
    vmNames: string[];
}

interface VMResult {
    vmName: string;
    success: boolean;
    message: string;
}

// Validate VM name to prevent injection
function isValidVmName(name: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}

// Get user info from SWA headers for audit logging
function getUserInfo(request: HttpRequest): { userId: string; userEmail: string } {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}

export async function BatchStopVMs(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const { userId, userEmail } = getUserInfo(request);

    // Parse request body
    let body: BatchStopRequest;
    try {
        body = await request.json() as BatchStopRequest;
    } catch {
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
    if (!VM_SUBSCRIPTION_ID || !VM_RESOURCE_GROUP) {
        context.error('Missing VM_SUBSCRIPTION_ID or VM_RESOURCE_GROUP configuration');
        return {
            status: 500,
            jsonBody: { error: 'Server configuration error' }
        };
    }

    // Audit log
    context.log({
        action: 'BatchStopVMs',
        vmNames: body.vmNames,
        vmCount: body.vmNames.length,
        resourceGroup: VM_RESOURCE_GROUP,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });

    try {
        // Use Managed Identity for authentication
        const credential = getAzureCredential();
        const client = new ComputeManagementClient(credential, VM_SUBSCRIPTION_ID);

        context.log(`Stopping ${body.vmNames.length} VMs in parallel: ${body.vmNames.join(', ')}`);

        // Stop all VMs in parallel (deallocate to save costs)
        const results = await Promise.allSettled(
            body.vmNames.map(async (vmName): Promise<VMResult> => {
                try {
                    const poller = await client.virtualMachines.beginDeallocate(VM_RESOURCE_GROUP, vmName);
                    await poller.pollUntilDone();
                    context.log(`VM ${vmName} stopped successfully`);
                    return {
                        vmName,
                        success: true,
                        message: `VM ${vmName} stopped successfully`
                    };
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    context.error(`Failed to stop VM ${vmName}: ${errorMessage}`);
                    return {
                        vmName,
                        success: false,
                        message: errorMessage
                    };
                }
            })
        );

        // Process results
        const vmResults: VMResult[] = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    vmName: body.vmNames[index],
                    success: false,
                    message: result.reason?.message || 'Unknown error'
                };
            }
        });

        const successCount = vmResults.filter(r => r.success).length;
        const failureCount = vmResults.filter(r => !r.success).length;

        context.log(`BatchStopVMs completed: ${successCount} succeeded, ${failureCount} failed`);

        return {
            status: failureCount === body.vmNames.length ? 500 : 200,
            jsonBody: {
                success: failureCount === 0,
                message: `Stopped ${successCount}/${body.vmNames.length} VMs`,
                results: vmResults,
                resourceGroup: VM_RESOURCE_GROUP
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`BatchStopVMs error:`, errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to stop VMs',
                message: errorMessage
            }
        };
    }
}

app.http('BatchStopVMs', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'vms/batch/stop',
    handler: BatchStopVMs
});
