/**
 * TriggerRunbook Function - Manually trigger a runbook
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AutomationClient } from '@azure/arm-automation';
import { getAzureCredential, VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP, AUTOMATION_ACCOUNT_NAME, validateConfiguration } from '../utils/azureAuth';

const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || 'abc661c5-b0eb-4f72-9c14-cf94e5914de6';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';

const ALLOWED_RUNBOOKS = ['Start-ScheduledVMs', 'Stop-ScheduledVMs'];

interface TriggerRunbookRequest {
    vmNames?: string;
}

// Get user info from SWA headers for audit logging
function getUserInfo(request: HttpRequest): { userId: string; userEmail: string } {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}

export async function TriggerRunbook(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const runbookName = request.params.runbookName;
    const { userId, userEmail } = getUserInfo(request);

    // Validate runbook name
    if (!runbookName || !ALLOWED_RUNBOOKS.includes(runbookName)) {
        return {
            status: 400,
            jsonBody: {
                error: 'Invalid runbook name',
                allowedRunbooks: ALLOWED_RUNBOOKS
            }
        };
    }

    // Parse request body (optional parameters)
    let body: TriggerRunbookRequest = {};
    try {
        const text = await request.text();
        if (text) {
            body = JSON.parse(text);
        }
    } catch {
        // Ignore parse errors, use defaults
    }

    // Audit log
    context.log({
        action: 'TriggerRunbook',
        runbookName,
        parameters: body,
        userId,
        userEmail,
        timestamp: new Date().toISOString()
    });

    try {
        const credential = getAzureCredential();
        const client = new AutomationClient(credential, AUTOMATION_SUBSCRIPTION_ID, 'status');

        // Start the runbook job
        const job = await client.job.create(
            AUTOMATION_RESOURCE_GROUP,
            AUTOMATION_ACCOUNT_NAME,
            `${runbookName}-${Date.now()}`,
            {
                runbook: {
                    name: runbookName
                },
                parameters: body.vmNames ? { VMNames: body.vmNames } : undefined
            }
        );

        context.log(`Runbook ${runbookName} triggered, job ID: ${job.jobId}`);

        return {
            status: 202,
            jsonBody: {
                success: true,
                message: `Runbook ${runbookName} triggered successfully`,
                jobId: job.jobId,
                status: job.status
            }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('TriggerRunbook error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to trigger runbook',
                message: errorMessage
            }
        };
    }
}

app.http('TriggerRunbook', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'runbooks/{runbookName}/run',
    handler: TriggerRunbook
});
