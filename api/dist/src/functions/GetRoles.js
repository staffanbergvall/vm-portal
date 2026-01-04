"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetRoles = GetRoles;
/**
 * GetRoles Function - Called by SWA after Entra ID authentication
 * Reads app roles from the user's token claims and returns them to SWA
 *
 * With App Roles approach, roles are already in the token - we just extract them
 */
const functions_1 = require("@azure/functions");
async function GetRoles(request, context) {
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
        const clientPrincipal = JSON.parse(Buffer.from(clientPrincipalHeader, 'base64').toString('utf-8'));
        context.log(`GetRoles called for user: ${clientPrincipal.userDetails}`);
        // Extract app roles from claims
        // App roles are in claims with typ 'roles' or 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
        const roleClaims = clientPrincipal.claims.filter(c => c.typ === 'roles' ||
            c.typ === 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role');
        const roles = roleClaims.map(c => c.val);
        // Also check userRoles from the built-in SWA roles
        const allRoles = [...new Set([...roles, ...clientPrincipal.userRoles])];
        context.log(`User ${clientPrincipal.userDetails} has roles: ${allRoles.join(', ')}`);
        return {
            status: 200,
            jsonBody: { roles: allRoles }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error('GetRoles error:', errorMessage);
        return {
            status: 200,
            jsonBody: { roles: [] }
        };
    }
}
functions_1.app.http('GetRoles', {
    methods: ['POST'],
    authLevel: 'anonymous', // Auth handled by SWA
    route: 'getroles',
    handler: GetRoles
});
//# sourceMappingURL=GetRoles.js.map