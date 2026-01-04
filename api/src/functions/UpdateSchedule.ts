/**
 * UpdateSchedule Function - Enable/disable a schedule or change schedule time
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AutomationClient } from '@azure/arm-automation';
import { getAzureCredential, VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP, AUTOMATION_ACCOUNT_NAME, validateConfiguration } from '../utils/azureAuth';
import { randomUUID } from 'crypto';

const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || 'abc661c5-b0eb-4f72-9c14-cf94e5914de6';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';

interface UpdateScheduleRequest {
    isEnabled?: boolean;
    startTime?: string; // HH:mm format
    weekDays?: string[]; // e.g., ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
}

// Validate schedule name
function isValidScheduleName(name: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(name);
}

// Get user info from SWA headers for audit logging
function getUserInfo(request: HttpRequest): { userId: string; userEmail: string } {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}

export async function UpdateSchedule(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
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
    let body: UpdateScheduleRequest;
    try {
        body = await request.json() as UpdateScheduleRequest;
    } catch {
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
        const credential = getAzureCredential();
        const client = new AutomationClient(credential, AUTOMATION_SUBSCRIPTION_ID, 'status');

        // Get current schedule
        const schedule = await client.schedule.get(
            AUTOMATION_RESOURCE_GROUP,
            AUTOMATION_ACCOUNT_NAME,
            scheduleName
        );

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
            const jobSchedules = await client.jobSchedule.listByAutomationAccount(
                AUTOMATION_RESOURCE_GROUP,
                AUTOMATION_ACCOUNT_NAME
            );
            const linkedRunbooks: string[] = [];
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
        } else {
            // Just update isEnabled
            updatedSchedule = await client.schedule.update(
                AUTOMATION_RESOURCE_GROUP,
                AUTOMATION_ACCOUNT_NAME,
                scheduleName,
                {
                    isEnabled: body.isEnabled,
                    description: schedule.description
                }
            );

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
    } catch (error: unknown) {
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

app.http('UpdateSchedule', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'schedules/{scheduleName}',
    handler: UpdateSchedule
});
