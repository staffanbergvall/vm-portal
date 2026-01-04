"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StopAppService = StopAppService;
/**
 * StopAppService Function - Stop a specific App Service
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
async function StopAppService(request, context) {
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
    if (!body.subscriptionId || !body.resourceGroup) {
        return {
            status: 400,
            jsonBody: { error: 'subscriptionId and resourceGroup are required' }
        };
    }
    // Audit log
    context.log({
        action: 'StopAppService',
        appServiceName,
        subscriptionId: body.subscriptionId,
        resourceGroup: body.resourceGroup,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });
    try {
        const credential = (0, azureAuth_1.getAzureCredential)();
        const client = new arm_appservice_1.WebSiteManagementClient(credential, body.subscriptionId);
        // Stop the App Service
        await client.webApps.stop(body.resourceGroup, appServiceName);
        context.log(`App Service ${appServiceName} stopped successfully`);
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `App Service ${appServiceName} stopped successfully`,
                appServiceName: appServiceName
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('StopAppService error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to stop App Service',
                message: errorMessage
            }
        };
    }
}
functions_1.app.http('StopAppService', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'appservices/{appServiceName}/stop',
    handler: StopAppService
});
//# sourceMappingURL=StopAppService.js.map