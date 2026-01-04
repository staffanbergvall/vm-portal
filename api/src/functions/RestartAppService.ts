/**
 * RestartAppService Function - Restart a specific App Service
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { getAzureCredential } from '../utils/azureAuth';

interface RestartAppServiceRequest {
    subscriptionId: string;
    resourceGroup: string;
}

// Validate app service name
function isValidAppServiceName(name: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/.test(name);
}

// Get user info from SWA headers for audit logging
function getUserInfo(request: HttpRequest): { userId: string; userEmail: string } {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}

export async function RestartAppService(
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
    let body: RestartAppServiceRequest;
    try {
        body = await request.json() as RestartAppServiceRequest;
    } catch {
        return {
            status: 400,
            jsonBody: { error: 'Invalid JSON body' }
        };
    }

    // Validate required fields
    if (!body.subscriptionId || !body.resourceGroup) {
        return {
            status: 400,
            jsonBody: { error: 'subscriptionId and resourceGroup are required' }
        };
    }

    // Audit log
    context.log({
        action: 'RestartAppService',
        appServiceName,
        subscriptionId: body.subscriptionId,
        resourceGroup: body.resourceGroup,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });

    try {
        const credential = getAzureCredential();
        const client = new WebSiteManagementClient(credential, body.subscriptionId);

        // Restart the App Service
        await client.webApps.restart(body.resourceGroup, appServiceName);

        context.log(`App Service ${appServiceName} restarted successfully`);

        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `App Service ${appServiceName} restarted successfully`,
                appServiceName: appServiceName
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('RestartAppService error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to restart App Service',
                message: errorMessage
            }
        };
    }
}

app.http('RestartAppService', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'appservices/{appServiceName}/restart',
    handler: RestartAppService
});
