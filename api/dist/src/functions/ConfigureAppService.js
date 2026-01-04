"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigureAppService = ConfigureAppService;
/**
 * ConfigureAppService Function - Update App Service configuration (app settings)
 */
const functions_1 = require("@azure/functions");
const arm_appservice_1 = require("@azure/arm-appservice");
const azureAuth_1 = require("../utils/azureAuth");
// Validate app service name
function isValidAppServiceName(name) {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/.test(name);
}
// Get user info from SWA headers for audit logging
function getUserInfo(request) {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}
async function ConfigureAppService(request, context) {
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
    let body;
    try {
        body = await request.json();
    }
    catch {
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
        const credential = (0, azureAuth_1.getAzureCredential)();
        const client = new arm_appservice_1.WebSiteManagementClient(credential, body.subscriptionId);
        // Get current app settings
        const currentSettings = await client.webApps.listApplicationSettings(body.resourceGroup, appServiceName);
        // Merge current settings with new settings (new settings override)
        const updatedSettings = {
            ...currentSettings.properties,
            ...body.appSettings
        };
        // Update app settings
        await client.webApps.updateApplicationSettings(body.resourceGroup, appServiceName, {
            properties: updatedSettings
        });
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
    }
    catch (error) {
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
functions_1.app.http('ConfigureAppService', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'appservices/{appServiceName}/configure',
    handler: ConfigureAppService
});
//# sourceMappingURL=ConfigureAppService.js.map