"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerRunbook = TriggerRunbook;
/**
 * TriggerRunbook Function - Manually trigger a runbook
 */
const functions_1 = require("@azure/functions");
const arm_automation_1 = require("@azure/arm-automation");
const azureAuth_1 = require("../utils/azureAuth");
const AUTOMATION_SUBSCRIPTION_ID = process.env.AUTOMATION_SUBSCRIPTION_ID || '5280b014-4b52-47a6-b447-00678b179005';
const AUTOMATION_RESOURCE_GROUP = process.env.AUTOMATION_RESOURCE_GROUP || 'rg-vmportal';
const ALLOWED_RUNBOOKS = ['Start-ScheduledVMs', 'Stop-ScheduledVMs'];
// Get user info from SWA headers for audit logging
function getUserInfo(request) {
    const userId = request.headers.get('x-ms-client-principal-id') || 'unknown';
    const userEmail = request.headers.get('x-ms-client-principal-name') || 'unknown';
    return { userId, userEmail };
}
async function TriggerRunbook(request, context) {
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
    let body = {};
    try {
        const text = await request.text();
        if (text) {
            body = JSON.parse(text);
        }
    }
    catch {
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
        const credential = (0, azureAuth_1.getAzureCredential)();
        const client = new arm_automation_1.AutomationClient(credential, AUTOMATION_SUBSCRIPTION_ID, 'status');
        // Start the runbook job
        const job = await client.job.create(AUTOMATION_RESOURCE_GROUP, azureAuth_1.AUTOMATION_ACCOUNT_NAME, `${runbookName}-${Date.now()}`, {
            runbook: {
                name: runbookName
            },
            parameters: body.vmNames ? { VMNames: body.vmNames } : undefined
        });
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
    }
    catch (error) {
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
functions_1.app.http('TriggerRunbook', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'runbooks/{runbookName}/run',
    handler: TriggerRunbook
});
//# sourceMappingURL=TriggerRunbook.js.map