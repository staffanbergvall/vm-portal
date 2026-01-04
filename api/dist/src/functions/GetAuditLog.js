"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAuditLog = GetAuditLog;
/**
 * GetAuditLog Function - Get audit log from Application Insights
 */
const functions_1 = require("@azure/functions");
const monitor_query_1 = require("@azure/monitor-query");
const identity_1 = require("@azure/identity");
// Helper function to process query result tables
function processQueryResult(result) {
    const entries = [];
    if (result.status !== monitor_query_1.LogsQueryResultStatus.Success && result.status !== monitor_query_1.LogsQueryResultStatus.PartialFailure) {
        return entries;
    }
    const tables = result.tables;
    if (!tables || tables.length === 0) {
        return entries;
    }
    const table = tables[0];
    const columnNames = table.columns.map(c => c.name);
    for (const row of table.rows) {
        const entry = {};
        columnNames.forEach((col, idx) => {
            entry[col] = row[idx];
        });
        entries.push({
            timestamp: String(entry.timestamp || ''),
            operation: String(entry.operation || ''),
            vmName: entry.vmName ? String(entry.vmName) : null,
            user: entry.user ? String(entry.user) : null,
            status: String(entry.status || 'Info'),
            message: entry.message ? String(entry.message) : null,
            duration: typeof entry.duration === 'number' ? entry.duration : null
        });
    }
    return entries;
}
async function GetAuditLog(request, context) {
    const hours = parseInt(request.query.get('hours') || '24', 10);
    const limit = Math.min(parseInt(request.query.get('limit') || '100', 10), 500);
    // Validate hours (1-168 = 1 week max)
    if (isNaN(hours) || hours < 1 || hours > 168) {
        return {
            status: 400,
            jsonBody: { error: 'Hours must be between 1 and 168' }
        };
    }
    context.log(`Getting audit log for past ${hours} hours, limit ${limit}`);
    try {
        const credential = new identity_1.DefaultAzureCredential();
        const client = new monitor_query_1.LogsQueryClient(credential);
        // Query requests table for function invocations
        const query = `
            requests
            | where timestamp > ago(${hours}h)
            | where name in ('StartVM', 'StopVM', 'RestartVM', 'BatchStartVMs', 'BatchStopVMs', 'UpdateSchedule', 'TriggerRunbook')
            | project
                timestamp,
                operation = name,
                status = case(success == true, 'Success', 'Error'),
                duration = duration,
                resultCode
            | order by timestamp desc
            | take ${limit}
        `;
        const result = await client.queryResource(`/subscriptions/5280b014-4b52-47a6-b447-00678b179005/resourceGroups/rg-vmportal/providers/Microsoft.Insights/components/appi-vmportalprod`, query, { duration: `PT${hours}H` });
        const entries = processQueryResult(result);
        return {
            status: 200,
            jsonBody: {
                entries,
                count: entries.length,
                hours,
                limit
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('GetAuditLog error:', errorMessage);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to get audit log',
                message: errorMessage
            }
        };
    }
}
functions_1.app.http('GetAuditLog', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'audit-log',
    handler: GetAuditLog
});
//# sourceMappingURL=GetAuditLog.js.map