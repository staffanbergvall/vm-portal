"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSchedules = ListSchedules;
/**
 * ListSchedules Function - Lists all schedules from Azure Automation
 */
const functions_1 = require("@azure/functions");
const arm_automation_1 = require("@azure/arm-automation");
const identity_1 = require("@azure/identity");
const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || '5280b014-4b52-47a6-b447-00678b179005';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';
const AUTOMATION_ACCOUNT_NAME = process.env.AUTOMATION_ACCOUNT_NAME || 'aa-vmportalprod-fg3mvon3';
async function ListSchedules(request, context) {
    context.log('ListSchedules function triggered');
    try {
        const credential = new identity_1.DefaultAzureCredential();
        const client = new arm_automation_1.AutomationClient(credential, AUTOMATION_SUBSCRIPTION_ID, 'status');
        const schedulesResult = await client.schedule.listByAutomationAccount(AUTOMATION_RESOURCE_GROUP, AUTOMATION_ACCOUNT_NAME);
        const schedules = (schedulesResult || []).map(schedule => ({
            name: schedule.name || '',
            description: schedule.description || null,
            isEnabled: schedule.isEnabled ?? false,
            frequency: schedule.frequency || 'Unknown',
            interval: schedule.interval ?? null,
            startTime: schedule.startTime?.toISOString() || null,
            nextRun: schedule.nextRun?.toISOString() || null,
            timeZone: schedule.timeZone || null,
            weekDays: schedule.advancedSchedule?.weekDays || null
        }));
        context.log(`Found ${schedules.length} schedules`);
        return {
            status: 200,
            jsonBody: {
                schedules,
                count: schedules.length,
                automationAccount: AUTOMATION_ACCOUNT_NAME
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('ListSchedules error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to list schedules',
                message: errorMessage
            }
        };
    }
}
functions_1.app.http('ListSchedules', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'schedules',
    handler: ListSchedules
});
//# sourceMappingURL=ListSchedules.js.map