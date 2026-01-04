"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetVMsSummary = GetVMsSummary;
/**
 * GetVMsSummary Function - Get summary metrics for all VMs
 */
const functions_1 = require("@azure/functions");
const arm_monitor_1 = require("@azure/arm-monitor");
const arm_compute_1 = require("@azure/arm-compute");
const identity_1 = require("@azure/identity");
const TARGET_SUBSCRIPTION_ID = process.env.TARGET_SUBSCRIPTION_ID || '1cb4c6d1-f67a-40ef-afd4-f5385d03e466';
const TARGET_RESOURCE_GROUP = process.env.TARGET_RESOURCE_GROUP || 'yourResourceGroup';
async function GetVMsSummary(request, context) {
    context.log('Getting VMs summary metrics');
    try {
        const credential = new identity_1.DefaultAzureCredential();
        const computeClient = new arm_compute_1.ComputeManagementClient(credential, TARGET_SUBSCRIPTION_ID);
        const monitorClient = new arm_monitor_1.MonitorClient(credential, TARGET_SUBSCRIPTION_ID);
        // Get all VMs
        const vmsIterator = computeClient.virtualMachines.list(TARGET_RESOURCE_GROUP);
        const vmsList = [];
        let totalRunning = 0;
        let totalStopped = 0;
        let cpuSum = 0;
        let cpuCount = 0;
        for await (const vm of vmsIterator) {
            if (!vm.name)
                continue;
            // Get instance view for power state
            const instanceView = await computeClient.virtualMachines.instanceView(TARGET_RESOURCE_GROUP, vm.name);
            const powerStateStatus = instanceView.statuses?.find(s => s.code?.startsWith('PowerState/'));
            const powerState = powerStateStatus?.code?.replace('PowerState/', '') || 'unknown';
            const isRunning = powerState.toLowerCase() === 'running';
            if (isRunning) {
                totalRunning++;
            }
            else {
                totalStopped++;
            }
            let cpuPercent = null;
            let networkInMB = null;
            let networkOutMB = null;
            // Only get metrics for running VMs
            if (isRunning) {
                try {
                    const resourceUri = `/subscriptions/${TARGET_SUBSCRIPTION_ID}/resourceGroups/${TARGET_RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${vm.name}`;
                    const metricsResponse = await monitorClient.metrics.list(resourceUri, {
                        timespan: 'PT1H',
                        interval: 'PT5M',
                        metricnames: 'Percentage CPU,Network In Total,Network Out Total',
                        aggregation: 'Average'
                    });
                    for (const metric of metricsResponse.value || []) {
                        const timeseries = metric.timeseries?.[0];
                        if (!timeseries?.data?.length)
                            continue;
                        // Get the most recent data point
                        const latestData = timeseries.data[timeseries.data.length - 1];
                        switch (metric.name?.value) {
                            case 'Percentage CPU':
                                cpuPercent = latestData.average ?? null;
                                if (cpuPercent !== null) {
                                    cpuSum += cpuPercent;
                                    cpuCount++;
                                }
                                break;
                            case 'Network In Total':
                                // Convert bytes to MB
                                networkInMB = latestData.average ? latestData.average / (1024 * 1024) : null;
                                break;
                            case 'Network Out Total':
                                networkOutMB = latestData.average ? latestData.average / (1024 * 1024) : null;
                                break;
                        }
                    }
                }
                catch (metricsError) {
                    context.warn(`Failed to get metrics for VM ${vm.name}:`, metricsError);
                }
            }
            vmsList.push({
                name: vm.name,
                powerState,
                cpuPercent: cpuPercent !== null ? Math.round(cpuPercent * 10) / 10 : null,
                networkInMB: networkInMB !== null ? Math.round(networkInMB * 100) / 100 : null,
                networkOutMB: networkOutMB !== null ? Math.round(networkOutMB * 100) / 100 : null
            });
        }
        const response = {
            vms: vmsList,
            totalRunning,
            totalStopped,
            avgCpu: cpuCount > 0 ? Math.round((cpuSum / cpuCount) * 10) / 10 : null,
            timestamp: new Date().toISOString()
        };
        return {
            status: 200,
            jsonBody: response
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('GetVMsSummary error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to get VMs summary',
                message: errorMessage
            }
        };
    }
}
functions_1.app.http('GetVMsSummary', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'vms/summary',
    handler: GetVMsSummary
});
//# sourceMappingURL=GetVMsSummary.js.map