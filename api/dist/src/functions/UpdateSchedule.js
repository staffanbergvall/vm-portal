"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSchedule = UpdateSchedule;
/**
 * UpdateSchedule Function - Enable/disable a schedule
 */
const functions_1 = require("@azure/functions");
const arm_automation_1 = require("@azure/arm-automation");
const identity_1 = require("@azure/identity");
const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || '5280b014-4b52-47a6-b447-00678b179005';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';
const AUTOMATION_ACCOUNT_NAME = process.env.AUTOMATION_ACCOUNT_NAME || 'aa-vmportalprod-fg3mvon3';
// Validate schedule name
function isValidScheduleName(name) {
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(name);
}
// Get user info from SWA headers for audit logging
function getUserInfo(request) {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}
async function UpdateSchedule(request, context) {
    const scheduleName = request.params.scheduleName;
    const { userId, userEmail } = getUserInfo(request);
    // Validate schedule name
    if (!scheduleName || !isValidScheduleName(scheduleName)) {
        return {
            status: 400,
            jsonBody: { error: 'Invalid schedule name' }
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
    // Validate request
    if (body.isEnabled === undefined) {
        return {
            status: 400,
            jsonBody: { error: 'isEnabled is required' }
        };
    }
    // Audit log
    context.log({
        action: 'UpdateSchedule',
        scheduleName,
        isEnabled: body.isEnabled,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });
    try {
        const credential = new identity_1.DefaultAzureCredential();
        const client = new arm_automation_1.AutomationClient(credential, AUTOMATION_SUBSCRIPTION_ID, 'status');
        // Get current schedule
        const schedule = await client.schedule.get(AUTOMATION_RESOURCE_GROUP, AUTOMATION_ACCOUNT_NAME, scheduleName);
        if (!schedule) {
            return {
                status: 404,
                jsonBody: { error: 'Schedule not found' }
            };
        }
        // Update schedule
        const updatedSchedule = await client.schedule.update(AUTOMATION_RESOURCE_GROUP, AUTOMATION_ACCOUNT_NAME, scheduleName, {
            isEnabled: body.isEnabled,
            description: schedule.description
        });
        context.log(`Schedule ${scheduleName} updated: isEnabled=${body.isEnabled}`);
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `Schedule ${scheduleName} ${body.isEnabled ? 'enabled' : 'disabled'}`,
                schedule: {
                    name: updatedSchedule.name,
                    isEnabled: updatedSchedule.isEnabled,
                    nextRun: updatedSchedule.nextRun?.toISOString()
                }
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('UpdateSchedule error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to update schedule',
                message: errorMessage
            }
        };
    }
}
functions_1.app.http('UpdateSchedule', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'schedules/{scheduleName}',
    handler: UpdateSchedule
});
//# sourceMappingURL=UpdateSchedule.js.map