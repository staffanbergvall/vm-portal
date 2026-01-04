# Ralph Wiggum Iteration 2 Summary
**Date:** January 4, 2026, 09:42 UTC
**Status:** 🔴 **BLOCKED** - Manual Azure Portal role assignment required

---

## ⚠️ ACTION REQUIRED

**This iteration cannot proceed automatically.**

Please complete the manual role assignment by following the detailed instructions in:

📋 **[MANUAL_ROLE_ASSIGNMENT.md](MANUAL_ROLE_ASSIGNMENT.md)**

**Quick action**: Grant "Virtual Machine Contributor" role to Service Principal `8cd63878-9d61-459f-ad17-1231bc054017` in Azure Portal.

**Time required**: 5-10 minutes

---

## Major Progress! 🎉

### Critical Discoveries

**BREAKTHROUGH:** Identified root cause of "crypto is not defined" error!

**Discovery:** Azure Static Web Apps **Managed Functions** (the default API) **DO NOT support Managed Identity** (DefaultAzureCredential) in code!

- Managed Identity in Static Web Apps is ONLY for:
  1. Authentication/authorization (built-in)
  2. Key Vault secrets in app settings
  3. Database connection configuration
- **NOT** for `DefaultAzureCredential` in API function code

**Source:** Microsoft Learn documentation states:
> "Key Vault integration is not available for static web apps using managed functions"
> "Azure Serverless Functions do not support direct Key Vault integration"

The IMDS endpoint is unavailable because managed functions run in a shared, multi-tenant environment.

### Fixes Applied in This Iteration

#### 1. Upgraded to Node.js 20 Runtime ✅
- **Problem**: `package.json` required Node >= 20, but runtime was set to `node:18`
- **Solution**: Updated `staticwebapp.config.json` to `apiRuntime: "node:20"`
- **Result**: Fixed "crypto is not defined" error (was actually a Node.js version mismatch)
- **Commit**: ec1ec2f

#### 2. Switched from DefaultAzureCredential to ClientSecretCredential ✅
- **Problem**: DefaultAzureCredential requires IMDS endpoint, unavailable in Static Web Apps managed functions
- **Solution**:
  - Created shared `api/src/utils/azureAuth.ts` module
  - Updated all 12 API functions to use `ClientSecretCredential`
  - Uses existing Service Principal (`ENTRA_CLIENT_ID` and `ENTRA_CLIENT_SECRET` from app settings)
- **Result**: API successfully authenticates to Azure! 🎉
- **Commit**: 89ece71

#### 3. Documented Cross-Subscription Architecture ✅
- Created `AZURE_RESOURCES.md` documenting:
  - SWA in subscription `5280b014-4b52-47a6-b447-00678b179005`
  - VMs in subscription `abc661c5-b0eb-4f72-9c14-cf94e5914de6`
  - Cross-subscription RBAC requirements
- **Commit**: dd8dbc9

## Current Status (Verified on Live Site)

### What's Working ✅

1. **Authentication**: User can log in with Entra ID ✓
2. **Authorization**: User has `vm-admin` role via Portal invitations ✓
3. **Frontend**: All pages load and render correctly ✓
4. **TypeScript**: Both frontend and API build without errors ✓
5. **Deployment**: GitHub Actions successfully deploys ✓
6. **Node.js 20**: Correct runtime version deployed ✓
7. **Service Principal Auth**: API successfully authenticates to Azure! 🎉
8. **No "crypto is not defined" error**: Issue completely resolved! ✓

### Current Blocker ⛔

**Service Principal lacks permissions to read VMs**

**Verified on vm.moderncloud.se**: Error banner shows authorization failure

**Error Message:**
```
The client '0bd7aea6-00f0-4e17-8e20-eae680740f70' with object id '8cd63878-9d61-459f-ad17-1231bc054017'
does not have authorization to perform action 'Microsoft.Compute/virtualMachines/read' over scope
'/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv/providers/Microsoft.Compute'
```

**Root Cause**: We previously granted "Virtual Machine Contributor" role to:
- ❌ Managed Identity: `13278b8f-bb98-4b33-84d4-d6de879c6909` (no longer used)
- ⏸️  Service Principal: `8cd63878-9d61-459f-ad17-1231bc054017` (currently used, but lacks permissions)

## Required Manual Step

**📋 SEE FILE**: `MANUAL_ROLE_ASSIGNMENT.md` for complete step-by-step instructions!

### Quick Summary:
Grant "Virtual Machine Contributor" role to the **Service Principal**
(not the Managed Identity - we don't use it anymore!)

### Service Principal Details:
- **Object ID (Principal ID)**: `8cd63878-9d61-459f-ad17-1231bc054017`
- **Application (Client) ID**: `0bd7aea6-00f0-4e17-8e20-eae680740f70`

### Why Manual Step Needed:
- Azure CLI on this system has DLL import errors
- Azure MCP tools don't support creating role assignments
- One-time setup - once done, portal will be fully functional

### Azure Portal Steps (Quick Reference):

1. Navigate to: https://portal.azure.com
2. Go to subscription: **Microsoft Azure Sponsorship 700 dollar** (`abc661c5-b0eb-4f72-9c14-cf94e5914de6`)
3. Go to Resource Group: **rg-migrate-hyperv**
4. Click **Access control (IAM)**
5. Click **+ Add** → **Add role assignment**
6. Select role: **Virtual Machine Contributor**
7. Click **Next**
8. Click **+ Select members**
9. Search for object ID: `8cd63878-9d61-459f-ad17-1231bc054017`
   (or application ID: `0bd7aea6-00f0-4e17-8e20-eae680740f70`)
10. Select the Service Principal
11. Click **Select**
12. Click **Review + assign**
13. Click **Review + assign** again

### Alternative: Azure CLI (if system is working):

```bash
az role assignment create \
  --assignee 8cd63878-9d61-459f-ad17-1231bc054017 \
  --role "Virtual Machine Contributor" \
  --scope "/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv"
```

**Note:** Azure CLI had DLL import errors during this iteration, so Portal is recommended.

## Verification After Manual Step

Once the role assignment is complete:

1. **Hard refresh**: https://vm.moderncloud.se (Ctrl+Shift+R)
2. **Expected results**:
   - ✅ No authorization error
   - ✅ Dashboard shows both VMs: vm-hyd-dc1 and vm-hyd-sync01
   - ✅ Dashboard shows "2 igång - 0 stoppade" (or correct state)
   - ✅ VM cards display with power state, location, size

## Next Iteration Tasks

After role assignment is complete, Ralph should continue with:

- [ ] Verify VM List Display (both VMs visible)
- [ ] Test VM Power Operations (Start/Stop/Restart buttons)
- [ ] Test VM Scheduling (view/enable/disable schedules)
- [ ] Test Monitoring Dashboard (metrics charts render)
- [ ] Test Audit Log (operation history displays)
- [ ] Test Error Handling (graceful failures)
- [ ] Verify Security & Performance (CSP, load times)
- [ ] Final validation of all Definition of Done criteria

## Files Modified This Iteration

### Created:
- `api/src/utils/azureAuth.ts` - Shared authentication module with ClientSecretCredential
- `AZURE_RESOURCES.md` - Cross-subscription architecture documentation
- `MANUAL_ROLE_ASSIGNMENT.md` - Step-by-step instructions for Azure Portal role assignment
- `ITERATION_2_SUMMARY.md` - This file (iteration status and discoveries)

### Modified:
- `frontend/public/staticwebapp.config.json` - Updated to Node.js 20
- `staticwebapp.config.json` - Updated to Node.js 20
- `api/src/functions/*.ts` - All 12 functions updated to use ClientSecretCredential:
  - BatchStartVMs.ts
  - BatchStopVMs.ts
  - GetAuditLog.ts
  - GetVMMetrics.ts
  - GetVMsSummary.ts
  - ListSchedules.ts
  - ListVMs.ts
  - RestartVM.ts
  - StartVM.ts
  - StopVM.ts
  - TriggerRunbook.ts
  - UpdateSchedule.ts

## Estimated Time to Production Ready

- **Manual step**: 5-10 minutes (Azure Portal role assignment)
- **Remaining automated testing**: 1-2 Ralph iterations (~10-20 minutes)
- **Total**: ~30 minutes to full production readiness

## Key Learnings

1. **Static Web Apps Managed Functions != Regular Azure Functions**:
   - Managed functions run in shared multi-tenant environment
   - No IMDS endpoint access
   - Cannot use DefaultAzureCredential in code
   - Must use Service Principal (ClientSecretCredential)

2. **Node.js Runtime Matters**:
   - "crypto is not defined" can mean Node.js version mismatch
   - Always match `apiRuntime` in config with `engines.node` in package.json

3. **Service Principal vs Managed Identity**:
   - For Static Web Apps managed functions: **Use Service Principal**
   - For "Bring Your Own Functions": Can use Managed Identity
   - Different auth methods = different identities = different RBAC needs

4. **Cross-Subscription RBAC**:
   - Azure CLI can have issues with cross-subscription role assignments
   - Azure REST API is more reliable
   - Azure Portal is most reliable for manual steps

## Commands to Resume Ralph Loop

After manual step is complete:

```bash
# Verify API is working
curl https://vm.moderncloud.se/api/vms

# If VMs are returned, resume Ralph Wiggum
/ralph-loop "$(cat PROMPT.md)" --completion-promise "VM-PORTAL-PRODUCTION-READY" --max-iterations 50
```
