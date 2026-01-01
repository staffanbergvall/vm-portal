/**
 * UpdateSchedule Function - Enable/disable a schedule
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AutomationClient } from '@azure/arm-automation';
import { DefaultAzureCredential } from '@azure/identity';

const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || '5280b014-4b52-47a6-b447-00678b179005';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';
const AUTOMATION_ACCOUNT_NAME = process.env.AUTOMATION_ACCOUNT_NAME || 'aa-vmportalprod-fg3mvon3';

interface UpdateScheduleRequest {
    isEnabled?: boolean;
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
        const credential = new DefaultAzureCredential();
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

        // Update schedule
        const updatedSchedule = await client.schedule.update(
            AUTOMATION_RESOURCE_GROUP,
            AUTOMATION_ACCOUNT_NAME,
            scheduleName,
            {
                isEnabled: body.isEnabled,
                description: schedule.description
            }
        );

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
