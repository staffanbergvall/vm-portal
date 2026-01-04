# Iteration 2: BLOCKED - Awaiting Manual Azure Portal Action

## Status: Cannot Proceed Automatically

This Ralph Wiggum iteration has **successfully completed all automated work** but is now **BLOCKED** on a manual Azure Portal step that cannot be performed programmatically.

## What Was Accomplished This Iteration ✅

### Major Breakthrough!
Identified and fixed the root cause of all API failures:

1. **Fixed "crypto is not defined" error**
   - Root cause: Node.js runtime version mismatch
   - Solution: Upgraded from Node.js 18 to Node.js 20
   - Result: Error eliminated! ✅

2. **Fixed authentication architecture**
   - Root cause: Azure Static Web Apps **managed functions don't support DefaultAzureCredential**
   - Critical discovery: IMDS endpoint unavailable in managed functions (shared multi-tenant environment)
   - Solution: Refactored all 12 API functions to use `ClientSecretCredential` with Service Principal
   - Result: API successfully authenticates to Azure! ✅

3. **Documented cross-subscription architecture**
   - Created `AZURE_RESOURCES.md` per user request
   - Documented VM location (subscription abc661c5-b0eb-4f72-9c14-cf94e5914de6)
   - Documented Static Web App location (subscription 5280b014-4b52-47a6-b447-00678b179005)
   - Documented cross-subscription RBAC requirements

4. **Code organization improvements**
   - Created shared `api/src/utils/azureAuth.ts` authentication module
   - Eliminated code duplication across all API functions
   - Added configuration validation
   - Improved error handling

## Current Blocker ⛔

**Service Principal needs "Virtual Machine Contributor" role**

### Why This Cannot Be Done Automatically:

1. **Azure CLI is broken on this system**
   ```
   ImportError: DLL load failed while importing win32file: The specified module could not be found.
   ```

2. **Azure MCP tools don't support role creation**
   - The `mcp__azure__role` tool only supports **listing** role assignments
   - No `create` or `assign` command available

3. **Cannot retrieve Service Principal credentials**
   - Client secret is stored in Azure Static Web App settings
   - Cannot be retrieved without working Azure CLI
   - Cannot get OAuth token to call Azure Management REST API directly

### What Needs to Be Done:

**Grant "Virtual Machine Contributor" role via Azure Portal**

- **To**: Service Principal with Object ID `8cd63878-9d61-459f-ad17-1231bc054017`
- **On**: Resource group `rg-migrate-hyperv`
- **In**: Subscription `abc661c5-b0eb-4f72-9c14-cf94e5914de6`

**Detailed instructions**: See `MANUAL_ROLE_ASSIGNMENT.md`

## Verification That Everything Else Works

**Live site tested**: https://vm.moderncloud.se

**Observed behavior** (screenshot verified):
- ✅ User authentication working (staffan.bergvall@moderncloud.se logged in)
- ✅ Authorization working (user has vm-admin role)
- ✅ Frontend loads correctly with navigation
- ✅ Node.js 20 runtime active (no "crypto is not defined" error)
- ✅ Service Principal successfully authenticates to Azure
- ⛔ Authorization error displays (expected - permissions not granted yet)

**Error message displayed**:
```
The client '0bd7aea6-00f0-4e17-8e20-eae680740f70' with object id '8cd63878-9d61-459f-ad17-1231bc054017'
does not have authorization to perform action 'Microsoft.Compute/virtualMachines/read' over scope
'/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv/providers/Microsoft.Compute'
or the scope is invalid. If access was recently granted, please refresh your credentials.
```

This error is **correct and expected**. It proves:
- Authentication is working (client ID is recognized)
- Service Principal exists and is valid
- API is successfully calling Azure
- Only missing piece: role assignment

## What Happens After Manual Step

Once the role is granted via Azure Portal:

1. **Immediate verification**:
   - Hard refresh: https://vm.moderncloud.se (Ctrl+Shift+R)
   - Error banner should disappear
   - VM list should show: vm-hyd-dc1 and vm-hyd-sync01
   - Dashboard should show correct power states

2. **Ralph Wiggum loop will continue**:
   - Next iteration will automatically proceed with testing
   - All Definition of Done criteria will be verified:
     - VM List Display
     - VM Power Operations
     - VM Scheduling
     - Monitoring Dashboard
     - Audit Log
     - Error Handling
     - Security & Performance

3. **Expected outcome**:
   - 1-2 more Ralph iterations (~10-20 minutes)
   - Full production readiness
   - `<promise>VM-PORTAL-PRODUCTION-READY</promise>` output when complete

## Files to Review

1. **`MANUAL_ROLE_ASSIGNMENT.md`** - Complete step-by-step instructions (START HERE!)
2. **`ITERATION_2_SUMMARY.md`** - Full technical details of this iteration
3. **`AZURE_RESOURCES.md`** - Cross-subscription architecture documentation
4. **`api/src/utils/azureAuth.ts`** - New shared authentication module

## Key Learnings from This Iteration

### Azure Static Web Apps Managed Functions Limitations:

**Managed Identity in Static Web Apps is ONLY for:**
- Built-in authentication/authorization
- Key Vault secrets in app settings
- Database connection configuration

**Managed Identity in Static Web Apps is NOT for:**
- Code-level SDK authentication (DefaultAzureCredential)
- IMDS endpoint access (not available in shared environment)

**Solution:**
- Use Service Principal (ClientSecretCredential) for code-level Azure SDK calls
- Store credentials in application settings (ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET)
- Grant RBAC permissions to the Service Principal (not the Managed Identity)

### Service Principal vs Managed Identity:

**Important distinction:**
- Iteration 1: Granted permissions to **Managed Identity** (principal `13278b8f-bb98-4b33-84d4-d6de879c6909`)
- Iteration 2: Now using **Service Principal** (principal `8cd63878-9d61-459f-ad17-1231bc054017`)
- These are **different identities** → need **different role assignments**
- The Managed Identity permissions are no longer used (but can be left in place)

### Node.js Runtime Versions:

**Always ensure consistency:**
- `package.json` engines.node requirement
- `staticwebapp.config.json` apiRuntime setting
- Mismatch can cause cryptic errors like "crypto is not defined"

## Estimated Time to Production

- **Manual step**: 5-10 minutes (Azure Portal)
- **RBAC propagation**: 30-60 seconds
- **Remaining automated testing**: 10-20 minutes (1-2 Ralph iterations)
- **Total**: ~30 minutes from manual step to production-ready

## How to Continue

After completing the manual role assignment (see `MANUAL_ROLE_ASSIGNMENT.md`):

```bash
# Verify the fix worked:
curl https://vm.moderncloud.se/api/vms

# If VMs are returned, the Ralph loop will continue automatically
# If still blocked, check RBAC propagation (wait 1-2 minutes, try again)
```

The Ralph Wiggum loop will detect that the blocker is resolved and continue with comprehensive testing.

---

**Summary**: All automated work is complete. One manual Azure Portal action needed. Then 30 minutes to production. 🚀
