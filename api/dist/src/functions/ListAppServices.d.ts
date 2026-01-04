/**
 * ListAppServices Function - List all App Services from all subscriptions
 * Scans all subscriptions the user has access to and groups App Services by resource group
 */
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare function ListAppServices(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
//# sourceMappingURL=ListAppServices.d.ts.map