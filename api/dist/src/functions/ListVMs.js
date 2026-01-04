"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListVMs = ListVMs;
/**
 * ListVMs Function - Returns all VMs in the target resource group with status
 */
const functions_1 = require("@azure/functions");
const arm_compute_1 = require("@azure/arm-compute");
const azureAuth_1 = require("../utils/azureAuth");
async function ListVMs(request, context) {
    try {
        // Validate configuration
        const configCheck = (0, azureAuth_1.validateConfiguration)();
        if (!configCheck.valid) {
            context.error(configCheck.error);
            return {
                status: 500,
                jsonBody: { error: configCheck.error }
            };
        }
        // Get Azure credential (Service Principal for Static Web Apps managed functions)
        const credential = (0, azureAuth_1.getAzureCredential)();
        const client = new arm_compute_1.ComputeManagementClient(credential, azureAuth_1.VM_SUBSCRIPTION_ID);
        const vms = [];
        // List all VMs in the resource group
        for await (const vm of client.virtualMachines.list(azureAuth_1.VM_RESOURCE_GROUP)) {
            // Get instance view for power state
            let powerState = 'unknown';
            let provisioningState = 'unknown';
            try {
                const instanceView = await client.virtualMachines.instanceView(azureAuth_1.VM_RESOURCE_GROUP, vm.name);
                // Extract power state from statuses
                const powerStatus = instanceView.statuses?.find(s => s.code?.startsWith('PowerState/'));
                powerState = powerStatus?.code?.replace('PowerState/', '') || 'unknown';
                // Extract provisioning state
                const provisioningStatus = instanceView.statuses?.find(s => s.code?.startsWith('ProvisioningState/'));
                provisioningState = provisioningStatus?.code?.replace('ProvisioningState/', '') || vm.provisioningState || 'unknown';
            }
            catch (err) {
                context.warn(`Could not get instance view for ${vm.name}: ${err}`);
            }
            vms.push({
                name: vm.name,
                id: vm.id,
                location: vm.location,
                vmSize: vm.hardwareProfile?.vmSize || 'unknown',
                powerState,
                osType: vm.storageProfile?.osDisk?.osType || 'unknown',
                provisioningState
            });
        }
        // Sort VMs by name
        vms.sort((a, b) => a.name.localeCompare(b.name));
        context.log(`Listed ${vms.length} VMs in ${azureAuth_1.VM_RESOURCE_GROUP}`);
        return {
            status: 200,
            jsonBody: {
                vms,
                count: vms.length,
                resourceGroup: azureAuth_1.VM_RESOURCE_GROUP,
                subscriptionId: azureAuth_1.VM_SUBSCRIPTION_ID
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('ListVMs error:', errorMessage);
        return {
            status: 500,
            jsonBody: { error: 'Failed to list VMs', message: errorMessage }
        };
    }
}
functions_1.app.http('ListVMs', {
    methods: ['GET'],
    authLevel: 'anonymous', // Auth handled by SWA
    route: 'vms',
    handler: ListVMs
});
//# sourceMappingURL=ListVMs.js.map