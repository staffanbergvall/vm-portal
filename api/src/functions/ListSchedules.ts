/**
 * ListSchedules Function - Lists all schedules from Azure Automation
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AutomationClient } from '@azure/arm-automation';
import { getAzureCredential, VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP, AUTOMATION_ACCOUNT_NAME, validateConfiguration } from '../utils/azureAuth';

const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || 'abc661c5-b0eb-4f72-9c14-cf94e5914de6';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';

interface ScheduleInfo {
    name: string;
    description: string | null;
    isEnabled: boolean;
    frequency: string;
    interval: number | null;
    startTime: string | null;
    nextRun: string | null;
    timeZone: string | null;
    weekDays: string[] | null;
}

export async function ListSchedules(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log('ListSchedules function triggered');

    try {
        const credential = getAzureCredential();
        const client = new AutomationClient(credential, AUTOMATION_SUBSCRIPTION_ID, 'status');

        const schedulesResult = await client.schedule.listByAutomationAccount(
            AUTOMATION_RESOURCE_GROUP,
            AUTOMATION_ACCOUNT_NAME
        );

        const schedules: ScheduleInfo[] = (schedulesResult || []).map(schedule => ({
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
    } catch (error: unknown) {
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

app.http('ListSchedules', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'schedules',
    handler: ListSchedules
});
