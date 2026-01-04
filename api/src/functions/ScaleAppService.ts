/**
 * ScaleAppService Function - Scale an App Service (change SKU/capacity)
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { getAzureCredential } from '../utils/azureAuth';

interface ScaleAppServiceRequest {
    subscriptionId: string;
    resourceGroup: string;
    sku: {
        name: string;  // e.g., "B1", "S1", "P1V2"
        tier: string;  // e.g., "Basic", "Standard", "PremiumV2"
        capacity?: number;  // Number of instances
    };
}

// Validate app service name
function isValidAppServiceName(name: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/.test(name);
}

// Extract App Service Plan name from serverFarmId
// Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/serverfarms/{planName}
function extractPlanName(serverFarmId: string): string {
    const match = serverFarmId.match(/\/serverfarms\/([^\/]+)/i);
    if (!match) {
        throw new Error('Invalid serverFarmId format');
    }
    return match[1];
}

// Get user info from SWA headers for audit logging
function getUserInfo(request: HttpRequest): { userId: string; userEmail: string } {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}

export async function ScaleAppService(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const appServiceName = request.params.appServiceName;
    const { userId, userEmail } = getUserInfo(request);

    // Validate app service name
    if (!appServiceName || !isValidAppServiceName(appServiceName)) {
        return {
            status: 400,
            jsonBody: { error: 'Invalid App Service name' }
        };
    }

    // Parse request body
    let body: ScaleAppServiceRequest;
    try {
        body = await request.json() as ScaleAppServiceRequest;
    } catch {
        return {
            status: 400,
            jsonBody: { error: 'Invalid JSON body' }
        };
    }

    // Validate required fields
    if (!body.subscriptionId || !body.resourceGroup || !body.sku || !body.sku.name || !body.sku.tier) {
        return {
            status: 400,
            jsonBody: { error: 'subscriptionId, resourceGroup, and sku (with name and tier) are required' }
        };
    }

    // Audit log
    context.log({
        action: 'ScaleAppService',
        appServiceName,
        subscriptionId: body.subscriptionId,
        resourceGroup: body.resourceGroup,
        sku: body.sku,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });

    try {
        // Note: Scaling via SDK requires further investigation
        // The @azure/arm-appservice SDK doesn't expose a simple update method for App Service Plan SKUs
        // This would need to be implemented via REST API similar to UpdateSchedule.ts

        context.warn('ScaleAppService: Feature not yet implemented - requires REST API');

        return {
            status: 501,
            jsonBody: {
                success: false,
                message: 'Scale feature not yet implemented - requires REST API integration',
                appServiceName: appServiceName
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('ScaleAppService error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to scale App Service',
                message: errorMessage
            }
        };
    }
}

app.http('ScaleAppService', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'appservices/{appServiceName}/scale',
    handler: ScaleAppService
});
