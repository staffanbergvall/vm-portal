/**
 * GetRoles Function - Called by SWA after Entra ID authentication
 * Reads app roles from the user's token claims and returns them to SWA
 *
 * With App Roles approach, roles are already in the token - we just extract them
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

interface ClientPrincipalClaim {
    typ: string;
    val: string;
}

interface ClientPrincipal {
    identityProvider: string;
    userId: string;
    userDetails: string;
    userRoles: string[];
    claims: ClientPrincipalClaim[];
}

export async function GetRoles(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        // Parse the client principal from SWA
        const clientPrincipalHeader = request.headers.get('x-ms-client-principal');

        if (!clientPrincipalHeader) {
            context.warn('No client principal header found');
            return {
                status: 200,
                jsonBody: { roles: [] }
            };
        }

        const clientPrincipal: ClientPrincipal = JSON.parse(
            Buffer.from(clientPrincipalHeader, 'base64').toString('utf-8')
        );

        context.log(`GetRoles called for user: ${clientPrincipal.userDetails}`);

        // Extract app roles from claims
        // App roles are in claims with typ 'roles' or 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
        const roleClaims = clientPrincipal.claims.filter(
            c => c.typ === 'roles' ||
                 c.typ === 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
        );

        const roles = roleClaims.map(c => c.val);

        // Also check userRoles from the built-in SWA roles
        const allRoles = [...new Set([...roles, ...clientPrincipal.userRoles])];

        context.log(`User ${clientPrincipal.userDetails} has roles: ${allRoles.join(', ')}`);

        return {
            status: 200,
            jsonBody: { roles: allRoles }
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('GetRoles error:', errorMessage);
        return {
            status: 200,
            jsonBody: { roles: [] }
        };
    }
}

app.http('GetRoles', {
    methods: ['POST'],
    authLevel: 'anonymous', // Auth handled by SWA
    route: 'GetRoles',
    handler: GetRoles
});
