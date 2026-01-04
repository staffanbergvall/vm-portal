/**
 * ConfigureAppService Function - Update App Service configuration (app settings)
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { getAzureCredential } from '../utils/azureAuth';

interface ConfigureAppServiceRequest {
    subscriptionId: string;
    resourceGroup: string;
    appSettings: Record<string, string>;
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

export async function ConfigureAppService(
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
    let body: ConfigureAppServiceRequest;
    try {
        body = await request.json() as ConfigureAppServiceRequest;
    } catch {
        return {
            status: 400,
            jsonBody: { error: 'Invalid JSON body' }
        };
    }

    // Validate required fields
    if (!body.subscriptionId || !body.resourceGroup || !body.appSettings) {
        return {
            status: 400,
            jsonBody: { error: 'subscriptionId, resourceGroup, and appSettings are required' }
        };
    }

    // Audit log
    context.log({
        action: 'ConfigureAppService',
        appServiceName,
        subscriptionId: body.subscriptionId,
        resourceGroup: body.resourceGroup,
        settingsCount: Object.keys(body.appSettings).length,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });

    try {
        const credential = getAzureCredential();
        const client = new WebSiteManagementClient(credential, body.subscriptionId);

        // Get current app settings
        const currentSettings = await client.webApps.listApplicationSettings(
            body.resourceGroup,
            appServiceName
        );

        // Merge current settings with new settings (new settings override)
        const updatedSettings = {
            ...currentSettings.properties,
            ...body.appSettings
        };

        // Update app settings
        await client.webApps.updateApplicationSettings(
            body.resourceGroup,
            appServiceName,
            {
                properties: updatedSettings
            }
        );

        context.log(`App Service ${appServiceName} configured successfully with ${Object.keys(body.appSettings).length} settings`);

        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `App Service ${appServiceName} configured successfully`,
                appServiceName: appServiceName,
                updatedSettings: Object.keys(body.appSettings)
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('ConfigureAppService error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to configure App Service',
                message: errorMessage
            }
        };
    }
}

app.http('ConfigureAppService', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'appservices/{appServiceName}/configure',
    handler: ConfigureAppService
});
