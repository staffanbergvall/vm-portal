/**
 * GetRoles Function - Called by SWA after Entra ID authentication
 * Reads app roles from the user's token claims and returns them to SWA
 *
 * With App Roles approach, roles are already in the token - we just extract them
 */
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare function GetRoles(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
//# sourceMappingURL=GetRoles.d.ts.map