/**
 * GetVMMetrics Function - Get Azure Monitor metrics for VMs
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MonitorClient } from '@azure/arm-monitor';
import { DefaultAzureCredential } from '@azure/identity';

const TARGET_SUBSCRIPTION_ID = process.env.TARGET_SUBSCRIPTION_ID || '1cb4c6d1-f67a-40ef-afd4-f5385d03e466';
const TARGET_RESOURCE_GROUP = process.env.TARGET_RESOURCE_GROUP || 'yourResourceGroup';

interface MetricDataPoint {
    timestamp: string;
    average: number | null;
    maximum: number | null;
    minimum: number | null;
}

interface VMMetrics {
    vmName: string;
    cpuPercent: MetricDataPoint[];
    networkIn: MetricDataPoint[];
    networkOut: MetricDataPoint[];
    diskReadBytes: MetricDataPoint[];
    diskWriteBytes: MetricDataPoint[];
}

// Validate VM name
function isValidVMName(name: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}

export async function GetVMMetrics(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const vmName = request.params.vmName;
    const timespan = request.query.get('timespan') || 'PT1H'; // Default 1 hour

    // Validate VM name
    if (!vmName || !isValidVMName(vmName)) {
        return {
            status: 400,
            jsonBody: { error: 'Invalid VM name' }
        };
    }

    // Validate timespan (PT1H, PT6H, PT12H, PT24H, P1D, P7D)
    const validTimespans = ['PT1H', 'PT6H', 'PT12H', 'PT24H', 'P1D', 'P7D'];
    if (!validTimespans.includes(timespan)) {
        return {
            status: 400,
            jsonBody: { error: 'Invalid timespan. Use PT1H, PT6H, PT12H, PT24H, P1D, or P7D' }
        };
    }

    context.log(`Getting metrics for VM ${vmName} with timespan ${timespan}`);

    try {
        const credential = new DefaultAzureCredential();
        const client = new MonitorClient(credential, TARGET_SUBSCRIPTION_ID);

        const resourceUri = `/subscriptions/${TARGET_SUBSCRIPTION_ID}/resourceGroups/${TARGET_RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${vmName}`;

        // Get interval based on timespan
        const interval = getIntervalForTimespan(timespan);

        // Fetch metrics
        const metricsResponse = await client.metrics.list(resourceUri, {
            timespan: timespan,
            interval: interval,
            metricnames: 'Percentage CPU,Network In Total,Network Out Total,Disk Read Bytes,Disk Write Bytes',
            aggregation: 'Average,Maximum,Minimum'
        });

        const metrics: VMMetrics = {
            vmName,
            cpuPercent: [],
            networkIn: [],
            networkOut: [],
            diskReadBytes: [],
            diskWriteBytes: []
        };

        // Process metrics
        for (const metric of metricsResponse.value || []) {
            const timeseries = metric.timeseries?.[0];
            if (!timeseries?.data) continue;

            const dataPoints: MetricDataPoint[] = timeseries.data.map(d => ({
                timestamp: d.timeStamp?.toISOString() || '',
                average: d.average ?? null,
                maximum: d.maximum ?? null,
                minimum: d.minimum ?? null
            }));

            switch (metric.name?.value) {
                case 'Percentage CPU':
                    metrics.cpuPercent = dataPoints;
                    break;
                case 'Network In Total':
                    metrics.networkIn = dataPoints;
                    break;
                case 'Network Out Total':
                    metrics.networkOut = dataPoints;
                    break;
                case 'Disk Read Bytes':
                    metrics.diskReadBytes = dataPoints;
                    break;
                case 'Disk Write Bytes':
                    metrics.diskWriteBytes = dataPoints;
                    break;
            }
        }

        return {
            status: 200,
            jsonBody: {
                metrics,
                timespan,
                interval
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('GetVMMetrics error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to get VM metrics',
                message: errorMessage
            }
        };
    }
}

function getIntervalForTimespan(timespan: string): string {
    switch (timespan) {
        case 'PT1H':
            return 'PT5M';  // 5 minute intervals for 1 hour
        case 'PT6H':
            return 'PT15M'; // 15 minute intervals for 6 hours
        case 'PT12H':
            return 'PT30M'; // 30 minute intervals for 12 hours
        case 'PT24H':
        case 'P1D':
            return 'PT1H';  // 1 hour intervals for 24 hours
        case 'P7D':
            return 'PT6H';  // 6 hour intervals for 7 days
        default:
            return 'PT5M';
    }
}

app.http('GetVMMetrics', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'vms/{vmName}/metrics',
    handler: GetVMMetrics
});
