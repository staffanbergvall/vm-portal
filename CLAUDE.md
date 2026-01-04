# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VM Portal is an Azure-based web application for managing (start/stop/restart) Azure virtual machines. The application features:

- **Frontend**: React SPA built with Vite (TypeScript)
- **Backend**: Azure Functions (Node.js/TypeScript)
- **Hosting**: Azure Static Web Apps (Standard tier)
- **Authentication**: Microsoft Entra ID with App Roles (`vm-admin` role required)
- **Scheduling**: Azure Automation runbooks for scheduled VM operations
- **Monitoring**: Application Insights with metrics dashboard and audit logging

## Development Commands

### API (Azure Functions)

```bash
cd api
npm install          # Install dependencies
npm run build        # Build TypeScript to dist/
npm run watch        # Build and watch for changes
npm start            # Run Functions locally (port 7071)
npm test             # Run tests
```

**Note**: The API uses `func start` which requires the Azure Functions Core Tools CLI.

### Frontend (React)

```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server (port 5173, proxies /api to 7071)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Infrastructure Deployment

Deploy main infrastructure (Static Web App, Function App, Storage, App Insights):

```bash
cd infrastructure
az deployment group create \
  --resource-group rg-vmportal \
  --template-file main.bicep \
  --parameters main.bicepparam
```

Deploy RBAC to target VM resource group (requires Function App Principal ID from deployment output):

```bash
PRINCIPAL_ID=$(az deployment group show -g rg-vmportal -n main --query properties.outputs.functionAppPrincipalId.value -o tsv)

az deployment group create \
  --resource-group <vm-resource-group> \
  --template-file rbac.bicep \
  --parameters functionAppPrincipalId=$PRINCIPAL_ID vmResourceGroup=<vm-resource-group>
```

Deploy Azure Automation for scheduling:

```bash
az deployment group create \
  --resource-group rg-vmportal \
  --template-file automation.bicep \
  --parameters automation.bicepparam
```

## Architecture

### Authentication Flow

1. Azure Static Web Apps handles Entra ID authentication via `staticwebapp.config.json`
2. User must have the `vm-admin` App Role assigned in Entra ID
3. SWA injects `x-ms-client-principal` header with user claims to API calls
4. `GetRoles` function extracts roles from claims and returns them to SWA
5. All API routes (except `/api/GetRoles`) require `vm-admin` role

### API Layer (Azure Functions)

All functions are defined in `api/src/functions/` and use the `@azure/functions` v4 programming model. Each function:
- Exports a handler function
- Registers itself using `app.http()` with route and auth configuration
- Uses `authLevel: 'anonymous'` (authentication is handled by SWA upstream)

**Key functions**:
- `ListVMs`: Lists all VMs in target resource group with power states
- `StartVM`/`StopVM`/`RestartVM`: Individual VM power operations
- `BatchStartVMs`/`BatchStopVMs`: Parallel operations on multiple VMs
- `GetRoles`: Role provider endpoint called by SWA
- `ListSchedules`/`UpdateSchedule`/`TriggerRunbook`: Azure Automation integration
- `GetVMMetrics`/`GetVMsSummary`/`GetAuditLog`: Monitoring and audit features

**Azure SDK Usage**:
- `@azure/identity`: **ClientSecretCredential** for Service Principal authentication (NOT DefaultAzureCredential - see Known Issues)
- `@azure/arm-compute`: ComputeManagementClient for VM operations
- `@azure/arm-automation`: AutomationManagementClient for runbook management
- `@azure/monitor-query`: LogsQueryClient for metrics and audit logs

**Environment Variables** (configured in Function App settings):
- `VM_SUBSCRIPTION_ID`: Target subscription containing VMs
- `VM_RESOURCE_GROUP`: Target resource group containing VMs
- `AZURE_TENANT_ID`: Entra ID tenant ID
- `ENTRA_CLIENT_ID`: Service Principal application (client) ID
- `ENTRA_CLIENT_SECRET`: Service Principal client secret
- `APPLICATIONINSIGHTS_CONNECTION_STRING`: App Insights connection

**Shared Authentication Module** (`api/src/utils/azureAuth.ts`):
All API functions use this shared module for authentication. It provides:
- `getAzureCredential()`: Returns ClientSecretCredential instance
- `validateConfiguration()`: Validates required environment variables
- Exports `VM_SUBSCRIPTION_ID`, `VM_RESOURCE_GROUP`, `AUTOMATION_ACCOUNT_NAME` constants

### Frontend Layer (React)

**Structure**:
- `src/pages/`: Page components (Dashboard, Monitoring, Schedules)
- `src/components/`: Reusable components (VMCard, VMList, StatusBadge)
- `src/App.tsx`: Main app with React Router
- `src/main.tsx`: Entry point

**Key patterns**:
- Uses native `fetch()` for API calls (no external HTTP library)
- SWA authentication is transparent - no auth code in frontend
- VM power states mapped to visual status badges
- Dashboard shows real-time VM status with start/stop/restart actions
- Monitoring page displays VM metrics from Application Insights
- Schedules page manages Azure Automation schedules

### RBAC and Security

**Function App Managed Identity** has a custom role `VM Power Operator` with minimal permissions:
- `Microsoft.Compute/virtualMachines/read`
- `Microsoft.Compute/virtualMachines/instanceView/read`
- `Microsoft.Compute/virtualMachines/start/action`
- `Microsoft.Compute/virtualMachines/deallocate/action`
- `Microsoft.Compute/virtualMachines/powerOff/action`
- `Microsoft.Resources/subscriptions/resourceGroups/read`

**Automation Account Managed Identity** needs the same permissions on the VM resource group.

**Security headers** are enforced via `staticwebapp.config.json` (CSP, X-Frame-Options, etc.)

### Azure Automation Scheduling

Azure Automation provides scheduled VM start/stop:
- `automation.bicep` deploys Automation Account with Managed Identity
- PowerShell runbooks: `Start-ScheduledVMs.ps1`, `Stop-ScheduledVMs.ps1`
- Default schedules: Weekday morning start (07:00), weekday evening stop (18:00)
- Schedules configured via Automation variables: `DefaultVMNames`, `VMSubscriptionId`, `VMResourceGroup`
- API endpoints allow viewing/updating schedules and manually triggering runbooks

### Deployment Pipeline

GitHub Actions workflow (`.github/workflows/azure-deploy.yml`):
1. Build API: `npm ci && npm run build` in `api/`
2. Build Frontend: `npm ci && npm run build` in `frontend/`
3. Deploy Frontend to Azure Static Web Apps (from `frontend/dist/`)
4. Deploy API to Azure Functions (from `api/dist/` with production dependencies)

**Secrets required**:
- `AZURE_STATIC_WEB_APPS_API_TOKEN_VMPORTAL`: SWA deployment token
- `AZURE_CREDENTIALS`: Azure service principal for Functions deployment

## Important Conventions

### TypeScript Configuration

- API uses `NodeNext` module resolution (ESM)
- Strict mode enabled
- Output to `dist/` directory
- Source maps and declarations generated

### Function Registration

Each function must:
1. Be imported in `api/src/functions/index.ts` (side-effect import)
2. Export a handler function
3. Call `app.http()` to register the route

Example:
```typescript
export async function MyFunction(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // implementation
}

app.http('MyFunction', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'my-route',
  handler: MyFunction
});
```

### VM Operations Pattern

All VM operations follow this pattern:
1. Extract VM name from route parameters
2. Validate environment configuration using `validateConfiguration()` from `azureAuth.ts`
3. Create credential using `getAzureCredential()` (returns ClientSecretCredential)
4. Create `ComputeManagementClient` with credential and `VM_SUBSCRIPTION_ID`
5. Perform operation using `client.virtualMachines.beginXxx()` (returns LRO poller)
6. Wait for completion with `poller.pollUntilDone()`
7. Log to Application Insights via `context.log()`
8. Return standardized JSON response

**Example:**
```typescript
import { getAzureCredential, VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP, validateConfiguration } from '../utils/azureAuth';

const configCheck = validateConfiguration();
if (!configCheck.valid) {
    return { status: 500, jsonBody: { error: configCheck.error } };
}

const credential = getAzureCredential();
const client = new ComputeManagementClient(credential, VM_SUBSCRIPTION_ID);
```

### Batch Operations

Batch operations use `Promise.all()` to parallelize VM operations:
```typescript
const operations = vmNames.map(name =>
  client.virtualMachines.beginStart(resourceGroup, name).then(p => p.pollUntilDone())
);
const results = await Promise.all(operations);
```

### Error Handling

- Always catch errors and return proper HTTP status codes
- Use `context.error()` for error logging to App Insights
- Return `{ error: string, message?: string }` JSON for errors
- Never expose internal configuration in error messages

## Common Gotchas

1. **Function App deployment**: Must copy `package.json`, `package-lock.json`, and `host.json` to `dist/` before deploying
2. **Managed Identity**: Function App needs RBAC role assignment on target VM resource group to work
3. **SWA Auth**: The `GetRoles` endpoint must allow `authenticated` role, not just `vm-admin`
4. **VM Power State**: Use `instanceView.statuses` to get current power state, not `vm.provisioningState`
5. **Deallocate vs PowerOff**: Always use `deallocate` to release compute charges, not `powerOff`
6. **Automation Runbooks**: Must be published after deployment before they can be scheduled or triggered
7. **Time Zones**: Azure Automation schedules use Windows time zone names (e.g., "W. Europe Standard Time")

## Testing Locally

1. Start API: `cd api && npm start`
2. Start Frontend: `cd frontend && npm run dev`
3. Frontend proxies `/api/*` requests to `http://localhost:7071`
4. **Note**: Local development bypasses Entra ID authentication. In production, SWA handles auth.

To test with real Azure resources:
- Set `VM_SUBSCRIPTION_ID` and `VM_RESOURCE_GROUP` in `api/local.settings.json`
- Authenticate with `az login` to use DefaultAzureCredential locally
- Ensure your user account has appropriate RBAC permissions on the VM resource group

## Known Issues and Solutions

### CRITICAL: Azure Static Web Apps Managed Functions Don't Support DefaultAzureCredential (Jan 2026)

**Symptom:** API returns errors like "crypto is not defined" or "ChainedTokenCredential authentication failed"

**Root Cause:**
Azure Static Web Apps managed functions run in a **shared multi-tenant environment** without access to the IMDS (Instance Metadata Service) endpoint. This means:
- `DefaultAzureCredential` does NOT work (tries to use IMDS for Managed Identity)
- Managed Identity authentication is ONLY available for:
  - Built-in SWA authentication/authorization
  - Key Vault secrets in application settings
  - Database connection configuration
- Managed Identity is NOT available for code-level Azure SDK calls

**Solution: Use Service Principal (ClientSecretCredential)**

1. **Create shared authentication module** (`api/src/utils/azureAuth.ts`):
   ```typescript
   import { ClientSecretCredential } from '@azure/identity';

   export function getAzureCredential(): ClientSecretCredential {
       return new ClientSecretCredential(
           process.env.AZURE_TENANT_ID,
           process.env.ENTRA_CLIENT_ID,
           process.env.ENTRA_CLIENT_SECRET
       );
   }
   ```

2. **Update all API functions** to use the shared module instead of DefaultAzureCredential

3. **Configure application settings** with Service Principal credentials:
   - `ENTRA_CLIENT_ID`: Service Principal application ID
   - `ENTRA_CLIENT_SECRET`: Service Principal secret
   - `AZURE_TENANT_ID`: Entra ID tenant ID

4. **Grant RBAC permissions** to the Service Principal (NOT Managed Identity):
   ```powershell
   New-AzRoleAssignment -ObjectId '<SERVICE_PRINCIPAL_OBJECT_ID>' `
     -RoleDefinitionName 'Virtual Machine Contributor' `
     -Scope '/subscriptions/<VM_SUBSCRIPTION_ID>/resourceGroups/<VM_RESOURCE_GROUP>'
   ```

**Current Implementation:**
- Service Principal Object ID: `8cd63878-9d61-459f-ad17-1231bc054017`
- All API functions use `ClientSecretCredential` via `azureAuth.ts`
- Permissions granted on both subscriptions (VM management and Automation/Monitoring)

### Stale Dist Configuration Issue (Jan 2026)

**Symptom:** Deployments don't reflect changes to `staticwebapp.config.json`

**Root Cause:** The `frontend/dist/staticwebapp.config.json` file wasn't being regenerated during builds.

**Solution:** Always rebuild frontend after modifying `frontend/public/staticwebapp.config.json`:
```bash
cd frontend
rm -rf dist
npm run build
git add dist
git commit -m "rebuild: Update frontend dist with latest config"
```

**Build Process:** The build script copies `frontend/public/staticwebapp.config.json` to `frontend/dist/staticwebapp.config.json` during the build.

