"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSchedule = UpdateSchedule;
/**
 * UpdateSchedule Function - Enable/disable a schedule or change schedule time
 */
const functions_1 = require("@azure/functions");
const arm_automation_1 = require("@azure/arm-automation");
const azureAuth_1 = require("../utils/azureAuth");
const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || 'abc661c5-b0eb-4f72-9c14-cf94e5914de6';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';
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
    // Validate request - at least one field must be provided
    if (body.isEnabled === undefined && !body.startTime && !body.weekDays) {
        return {
            status: 400,
            jsonBody: { error: 'At least one of isEnabled, startTime, or weekDays is required' }
        };
    }
    // Validate time format if provided
    if (body.startTime && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(body.startTime)) {
        return {
            status: 400,
            jsonBody: { error: 'Invalid time format. Use HH:mm (e.g., "07:00")' }
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
        const credential = (0, azureAuth_1.getAzureCredential)();
        const client = new arm_automation_1.AutomationClient(credential, AUTOMATION_SUBSCRIPTION_ID, 'status');
        // Get current schedule
        const schedule = await client.schedule.get(AUTOMATION_RESOURCE_GROUP, azureAuth_1.AUTOMATION_ACCOUNT_NAME, scheduleName);
        if (!schedule) {
            return {
                status: 404,
                jsonBody: { error: 'Schedule not found' }
            };
        }
        let updatedSchedule;
        // If changing time or weekdays, we need to delete and recreate
        if (body.startTime || body.weekDays) {
            // Get linked runbooks before deleting
            const jobSchedules = await client.jobSchedule.listByAutomationAccount(AUTOMATION_RESOURCE_GROUP, azureAuth_1.AUTOMATION_ACCOUNT_NAME);
            const linkedRunbooks = [];
            for await (const js of jobSchedules) {
                if (js.schedule?.name === scheduleName && js.runbook?.name) {
                    linkedRunbooks.push(js.runbook.name);
                }
            }
            // Azure Automation SDK limitation: Cannot modify schedule startTime via update()
            // Need to use Azure REST API or redeploy via Bicep
            return {
                status: 501,
                jsonBody: {
                    error: 'Time modification not yet implemented',
                    message: 'Azure Automation does not support changing schedule times via the SDK. Please redeploy the schedule via Bicep or use the Azure Portal.'
                }
            };
        }
        else {
            // Just update isEnabled
            updatedSchedule = await client.schedule.update(AUTOMATION_RESOURCE_GROUP, azureAuth_1.AUTOMATION_ACCOUNT_NAME, scheduleName, {
                isEnabled: body.isEnabled,
                description: schedule.description
            });
            context.log(`Schedule ${scheduleName} updated: isEnabled=${body.isEnabled}`);
        }
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: `Schedule ${scheduleName} updated successfully`,
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