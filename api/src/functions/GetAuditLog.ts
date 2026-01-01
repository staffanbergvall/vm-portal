/**
 * GetAuditLog Function - Get audit log from Application Insights
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query';
import { DefaultAzureCredential } from '@azure/identity';

interface AuditLogEntry {
    timestamp: string;
    operation: string;
    vmName: string | null;
    user: string | null;
    status: string;
    message: string | null;
    duration: number | null;
}

// Helper function to process query result tables
function processQueryResult(result: { status: LogsQueryResultStatus; tables?: unknown[] }): AuditLogEntry[] {
    const entries: AuditLogEntry[] = [];

    if (result.status !== LogsQueryResultStatus.Success && result.status !== LogsQueryResultStatus.PartialFailure) {
        return entries;
    }

    const tables = result.tables as Array<{
        columns: Array<{ name: string }>;
        rows: unknown[][];
    }>;

    if (!tables || tables.length === 0) {
        return entries;
    }

    const table = tables[0];
    const columnNames = table.columns.map(c => c.name);

    for (const row of table.rows) {
        const entry: Record<string, unknown> = {};
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

export async function GetAuditLog(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
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
        const credential = new DefaultAzureCredential();
        const client = new LogsQueryClient(credential);

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

        const result = await client.queryResource(
            `/subscriptions/5280b014-4b52-47a6-b447-00678b179005/resourceGroups/rg-vmportal/providers/Microsoft.Insights/components/appi-vmportalprod`,
            query,
            { duration: `PT${hours}H` }
        );

        const entries = processQueryResult(result as { status: LogsQueryResultStatus; tables?: unknown[] });

        return {
            status: 200,
            jsonBody: {
                entries,
                count: entries.length,
                hours,
                limit
            }
        };
    } catch (error: unknown) {
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

app.http('GetAuditLog', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'audit-log',
    handler: GetAuditLog
});
