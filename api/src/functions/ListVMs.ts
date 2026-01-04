/**
 * ListVMs Function - Returns all VMs in the target resource group with status
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ComputeManagementClient } from '@azure/arm-compute';
import { getAzureCredential, VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP, validateConfiguration } from '../utils/azureAuth';

interface VMInfo {
    name: string;
    id: string;
    location: string;
    vmSize: string;
    powerState: string;
    osType: string;
    provisioningState: string;
}

export async function ListVMs(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        // Validate configuration
        const configCheck = validateConfiguration();
        if (!configCheck.valid) {
            context.error(configCheck.error);
            return {
                status: 500,
                jsonBody: { error: configCheck.error }
            };
        }

        // Get Azure credential (Service Principal for Static Web Apps managed functions)
        const credential = getAzureCredential();
        const client = new ComputeManagementClient(credential, VM_SUBSCRIPTION_ID);

        const vms: VMInfo[] = [];

        // List all VMs in the resource group
        for await (const vm of client.virtualMachines.list(VM_RESOURCE_GROUP)) {
            // Get instance view for power state
            let powerState = 'unknown';
            let provisioningState = 'unknown';

            try {
                const instanceView = await client.virtualMachines.instanceView(
                    VM_RESOURCE_GROUP,
                    vm.name!
                );

                // Extract power state from statuses
                const powerStatus = instanceView.statuses?.find(
                    s => s.code?.startsWith('PowerState/')
                );
                powerState = powerStatus?.code?.replace('PowerState/', '') || 'unknown';

                // Extract provisioning state
                const provisioningStatus = instanceView.statuses?.find(
                    s => s.code?.startsWith('ProvisioningState/')
                );
                provisioningState = provisioningStatus?.code?.replace('ProvisioningState/', '') || vm.provisioningState || 'unknown';
            } catch (err) {
                context.warn(`Could not get instance view for ${vm.name}: ${err}`);
            }

            vms.push({
                name: vm.name!,
                id: vm.id!,
                location: vm.location!,
                vmSize: vm.hardwareProfile?.vmSize || 'unknown',
                powerState,
                osType: vm.storageProfile?.osDisk?.osType || 'unknown',
                provisioningState
            });
        }

        // Sort VMs by name
        vms.sort((a, b) => a.name.localeCompare(b.name));

        context.log(`Listed ${vms.length} VMs in ${VM_RESOURCE_GROUP}`);

        return {
            status: 200,
            jsonBody: {
                vms,
                count: vms.length,
                resourceGroup: VM_RESOURCE_GROUP,
                subscriptionId: VM_SUBSCRIPTION_ID
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('ListVMs error:', errorMessage);
        return {
            status: 500,
            jsonBody: { error: 'Failed to list VMs', message: errorMessage }
        };
    }
}

app.http('ListVMs', {
    methods: ['GET'],
    authLevel: 'anonymous', // Auth handled by SWA
    route: 'vms',
    handler: ListVMs
});
