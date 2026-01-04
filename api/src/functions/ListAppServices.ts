/**
 * ListAppServices Function - List all App Services from all subscriptions
 * Scans all subscriptions the user has access to and groups App Services by resource group
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { SubscriptionClient } from '@azure/arm-subscriptions';
import { getAzureCredential } from '../utils/azureAuth';

interface AppServiceInfo {
    name: string;
    id: string;
    subscriptionId: string;
    subscriptionName: string;
    resourceGroup: string;
    location: string;
    state: string;
    sku: string | null;
    kind: string | null;
}

// Extract resource group name from Azure resource ID
// Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/...
function extractResourceGroup(resourceId: string): string {
    const match = resourceId.match(/\/resourceGroups\/([^\/]+)\//i);
    return match ? match[1] : 'unknown';
}

// Group App Services by resource group
function groupByResourceGroup(appServices: AppServiceInfo[]): Record<string, AppServiceInfo[]> {
    const grouped: Record<string, AppServiceInfo[]> = {};

    for (const app of appServices) {
        if (!grouped[app.resourceGroup]) {
            grouped[app.resourceGroup] = [];
        }
        grouped[app.resourceGroup].push(app);
    }

    return grouped;
}

export async function ListAppServices(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        const credential = getAzureCredential();

        // 1. List all subscriptions
        const subscriptionClient = new SubscriptionClient(credential);
        const subscriptions = subscriptionClient.subscriptions.list();

        const allAppServices: AppServiceInfo[] = [];
        const subscriptionsScanned: string[] = [];
        const failedSubscriptions: Array<{ id: string; error: string }> = [];

        // 2. Iterate over each subscription and collect App Services
        for await (const sub of subscriptions) {
            if (!sub.subscriptionId || !sub.displayName) continue;

            try {
                subscriptionsScanned.push(sub.subscriptionId);

                const appServiceClient = new WebSiteManagementClient(credential, sub.subscriptionId);
                const sites = appServiceClient.webApps.list();

                for await (const site of sites) {
                    if (!site.name || !site.id) continue;

                    const resourceGroup = extractResourceGroup(site.id);

                    allAppServices.push({
                        name: site.name,
                        id: site.id,
                        subscriptionId: sub.subscriptionId,
                        subscriptionName: sub.displayName,
                        resourceGroup: resourceGroup,
                        location: site.location || 'unknown',
                        state: site.state || 'Unknown',
                        sku: null, // SKU is on App Service Plan, not the site
                        kind: site.kind || null
                    });
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                context.warn(`Failed to list App Services in subscription ${sub.displayName}: ${errorMessage}`);
                failedSubscriptions.push({
                    id: sub.subscriptionId,
                    error: errorMessage
                });
                // Continue with other subscriptions
            }
        }

        // 3. Group by resource group
        const grouped = groupByResourceGroup(allAppServices);

        context.log(`Listed ${allAppServices.length} App Services from ${subscriptionsScanned.length} subscriptions`);

        return {
            status: 200,
            jsonBody: {
                appServicesByResourceGroup: grouped,
                totalCount: allAppServices.length,
                subscriptionsScanned: subscriptionsScanned,
                failedSubscriptions: failedSubscriptions.length > 0 ? failedSubscriptions : undefined
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('ListAppServices error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to list App Services',
                message: errorMessage
            }
        };
    }
}

app.http('ListAppServices', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'appservices',
    handler: ListAppServices
});
