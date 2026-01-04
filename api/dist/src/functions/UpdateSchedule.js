"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSchedule = UpdateSchedule;
/**
 * UpdateSchedule Function - Enable/disable a schedule or change schedule time
 */
const functions_1 = require("@azure/functions");
const arm_automation_1 = require("@azure/arm-automation");
const azureAuth_1 = require("../utils/azureAuth");
const crypto_1 = require("crypto");
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
        // If changing time or weekdays, we need to delete and recreate via REST API
        if (body.startTime || body.weekDays) {
            // Get linked runbooks before deleting
            const jobSchedules = await client.jobSchedule.listByAutomationAccount(AUTOMATION_RESOURCE_GROUP, azureAuth_1.AUTOMATION_ACCOUNT_NAME);
            const linkedRunbooks = [];
            for await (const js of jobSchedules) {
                if (js.schedule?.name === scheduleName && js.runbook?.name) {
                    linkedRunbooks.push({
                        name: js.runbook.name,
                        runOn: js.runOn
                    });
                }
            }
            // Job schedule links will be automatically removed when schedule is deleted
            // Get access token for Azure Management API
            const token = await credential.getToken(['https://management.azure.com/.default']);
            if (!token) {
                throw new Error('Failed to get Azure access token');
            }
            const apiVersion = '2022-08-08';
            const scheduleUrl = `https://management.azure.com/subscriptions/${AUTOMATION_SUBSCRIPTION_ID}/resourceGroups/${AUTOMATION_RESOURCE_GROUP}/providers/Microsoft.Automation/automationAccounts/${azureAuth_1.AUTOMATION_ACCOUNT_NAME}/schedules/${scheduleName}?api-version=${apiVersion}`;
            // Delete the schedule via REST API
            const deleteResponse = await fetch(scheduleUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!deleteResponse.ok && deleteResponse.status !== 404) {
                throw new Error(`Failed to delete schedule: ${deleteResponse.statusText}`);
            }
            // Wait a moment for delete to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Calculate next start time based on new time and weekdays
            const newWeekDays = body.weekDays || schedule.advancedSchedule?.weekDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const newTime = body.startTime || '07:00';
            const [hours, minutes] = newTime.split(':').map(Number);
            // Calculate next occurrence
            const now = new Date();
            const nextStart = new Date(now);
            nextStart.setHours(hours, minutes, 0, 0);
            // If time has passed today, start from tomorrow
            if (nextStart <= now) {
                nextStart.setDate(nextStart.getDate() + 1);
            }
            // Find next matching weekday
            const dayMap = {
                'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
                'Thursday': 4, 'Friday': 5, 'Saturday': 6
            };
            const targetDays = newWeekDays.map(d => dayMap[d]);
            while (!targetDays.includes(nextStart.getDay())) {
                nextStart.setDate(nextStart.getDate() + 1);
            }
            // Create new schedule via REST API
            const createPayload = {
                properties: {
                    description: schedule.description || `Updated ${scheduleName}`,
                    startTime: nextStart.toISOString(),
                    expiryTime: schedule.expiryTime || '9999-12-31T23:59:59.999Z',
                    interval: 1,
                    frequency: 'Week',
                    timeZone: schedule.timeZone || 'W. Europe Standard Time',
                    advancedSchedule: {
                        weekDays: newWeekDays
                    },
                    isEnabled: body.isEnabled !== undefined ? body.isEnabled : schedule.isEnabled
                }
            };
            const createResponse = await fetch(scheduleUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(createPayload)
            });
            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to create schedule: ${errorText}`);
            }
            updatedSchedule = await createResponse.json();
            // Recreate job schedule links
            for (const runbook of linkedRunbooks) {
                const jobScheduleId = (0, crypto_1.randomUUID)();
                try {
                    await client.jobSchedule.create(AUTOMATION_RESOURCE_GROUP, azureAuth_1.AUTOMATION_ACCOUNT_NAME, jobScheduleId, {
                        schedule: { name: scheduleName },
                        runbook: { name: runbook.name },
                        runOn: runbook.runOn
                    });
                }
                catch (error) {
                    context.warn(`Failed to recreate job schedule for ${runbook.name}:`, error);
                }
            }
            context.log(`Schedule ${scheduleName} recreated with new time/days`);
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
                    name: updatedSchedule.name || updatedSchedule.properties?.name || scheduleName,
                    isEnabled: updatedSchedule.isEnabled ?? updatedSchedule.properties?.isEnabled,
                    nextRun: updatedSchedule.nextRun?.toISOString() || updatedSchedule.properties?.nextRun
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