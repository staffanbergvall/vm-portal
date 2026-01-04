/**
 * GetVMsSummary Function - Get summary metrics for all VMs
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MonitorClient } from '@azure/arm-monitor';
import { ComputeManagementClient } from '@azure/arm-compute';
import { getAzureCredential, VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP, validateConfiguration } from '../utils/azureAuth';

interface VMSummary {
    name: string;
    powerState: string;
    cpuPercent: number | null;
    networkInMB: number | null;
    networkOutMB: number | null;
}

interface SummaryResponse {
    vms: VMSummary[];
    totalRunning: number;
    totalStopped: number;
    avgCpu: number | null;
    timestamp: string;
}

export async function GetVMsSummary(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log('Getting VMs summary metrics');

    try {
        const configCheck = validateConfiguration();
        if (!configCheck.valid) {
            context.error(configCheck.error);
            return { status: 500, jsonBody: { error: configCheck.error } };
        }

        const credential = getAzureCredential();
        const computeClient = new ComputeManagementClient(credential, VM_SUBSCRIPTION_ID);
        const monitorClient = new MonitorClient(credential, VM_SUBSCRIPTION_ID);

        // Get all VMs
        const vmsIterator = computeClient.virtualMachines.list(VM_RESOURCE_GROUP);
        const vmsList: VMSummary[] = [];
        let totalRunning = 0;
        let totalStopped = 0;
        let cpuSum = 0;
        let cpuCount = 0;

        for await (const vm of vmsIterator) {
            if (!vm.name) continue;

            // Get instance view for power state
            const instanceView = await computeClient.virtualMachines.instanceView(
                VM_RESOURCE_GROUP,
                vm.name
            );

            const powerStateStatus = instanceView.statuses?.find(s =>
                s.code?.startsWith('PowerState/')
            );
            const powerState = powerStateStatus?.code?.replace('PowerState/', '') || 'unknown';

            const isRunning = powerState.toLowerCase() === 'running';
            if (isRunning) {
                totalRunning++;
            } else {
                totalStopped++;
            }

            let cpuPercent: number | null = null;
            let networkInMB: number | null = null;
            let networkOutMB: number | null = null;

            // Only get metrics for running VMs
            if (isRunning) {
                try {
                    const resourceUri = `/subscriptions/${VM_SUBSCRIPTION_ID}/resourceGroups/${VM_RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${vm.name}`;

                    const metricsResponse = await monitorClient.metrics.list(resourceUri, {
                        timespan: 'PT1H',
                        interval: 'PT5M',
                        metricnames: 'Percentage CPU,Network In Total,Network Out Total',
                        aggregation: 'Average'
                    });

                    for (const metric of metricsResponse.value || []) {
                        const timeseries = metric.timeseries?.[0];
                        if (!timeseries?.data?.length) continue;

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
                } catch (metricsError) {
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

        const response: SummaryResponse = {
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
    } catch (error: unknown) {
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

app.http('GetVMsSummary', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'vms/summary',
    handler: GetVMsSummary
});
