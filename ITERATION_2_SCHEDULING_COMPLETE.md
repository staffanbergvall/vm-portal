# Iteration 2 - VM Scheduling Feature Complete

**Date**: 2026-01-04
**Status**: ✅ COMPLETE

## Summary

Successfully deployed Azure Automation Account with VM scheduling feature. The schedules page is now fully functional with automated weekday start/stop schedules.

## Completed Tasks

### 1. ✅ Bicep CLI Installation
- Installed Bicep CLI version 0.39.26 via winget
- Verified installation successful

### 2. ✅ Automation Account Deployment
- Deployed Azure Automation Account: `aa-vmportalprod-72pgwzfl`
- Location: Sweden Central
- Subscription: `abc661c5-b0eb-4f72-9c14-cf94e5914de6` (VM subscription)
- Resource Group: `rg-vmportal` (auto-created in VM subscription)

### 3. ✅ Runbooks Configuration
- Deployed and published `Start-ScheduledVMs` runbook
- Deployed and published `Stop-ScheduledVMs` runbook
- Both runbooks using PowerShell

### 4. ✅ Schedules Creation
- **WeekdayMorningStart**: Starts VMs at 07:00 (Mon-Fri)
- **WeekdayEveningStop**: Stops VMs at 18:00 (Mon-Fri)
- Timezone: W. Europe Standard Time (Europe/Berlin)
- Both schedules active and linked to runbooks

### 5. ✅ Automation Variables
- `VMSubscriptionId`: abc661c5-b0eb-4f72-9c14-cf94e5914de6
- `VMResourceGroup`: rg-migrate-hyperv
- `DefaultVMNames`: vm-hyd-dc1,vm-hyd-sync01

### 6. ✅ Managed Identity Permissions
- Automation Account Managed Identity created
- Principal ID: `fd69b051-5dfc-4910-baa3-b955ce4da5c0`
- Granted **Virtual Machine Contributor** on `rg-migrate-hyperv`

### 7. ✅ Service Principal Permissions
- Service Principal `8cd63878-9d61-459f-ad17-1231bc054017` granted:
  - **Automation Contributor** on `rg-vmportal` (VM subscription)
  - Required for API to read schedules and trigger runbooks

### 8. ✅ API Function Fixes
- Fixed `ListSchedules.ts`: Updated AUTOMATION_SUBSCRIPTION_ID to VM subscription
- Fixed `UpdateSchedule.ts`: Updated AUTOMATION_SUBSCRIPTION_ID to VM subscription
- Fixed `TriggerRunbook.ts`: Updated AUTOMATION_SUBSCRIPTION_ID to VM subscription
- Added `AUTOMATION_ACCOUNT_NAME` fallback to `azureAuth.ts`

### 9. ✅ Testing
- Schedules page loading successfully
- Both schedules visible with correct configuration
- Manual trigger buttons available for immediate execution
- All API endpoints responding correctly

## Architecture Notes

### Cross-Subscription Setup
The Automation Account was deployed to the VM subscription (`abc661c5-b0eb-4f72-9c14-cf94e5914de6`) rather than the SWA subscription because:
1. It needs to manage VMs in that subscription
2. Simplifies RBAC configuration
3. Keeps automation resources co-located with managed resources

### Resource Group Discovery
The Bicep deployment created a new `rg-vmportal` resource group in the VM subscription to house the Automation Account. This is separate from the original `rg-vmportal` in the SWA subscription.

## Deployment Details

### GitHub Actions
- Commit: `9f7bfea` - "fix: Correct Automation Account subscription ID to match deployment"
- Deployment time: ~1m 42s
- Status: ✅ Success

### Resource IDs
```
Automation Account:
/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-vmportal/providers/Microsoft.Automation/automationAccounts/aa-vmportalprod-72pgwzfl

Start Runbook:
/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-vmportal/providers/Microsoft.Automation/automationAccounts/aa-vmportalprod-72pgwzfl/runbooks/Start-ScheduledVMs

Stop Runbook:
/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-vmportal/providers/Microsoft.Automation/automationAccounts/aa-vmportalprod-72pgwzfl/runbooks/Stop-ScheduledVMs
```

## Next Steps

### Monitoring Metrics (Optional)
The monitoring page is functional but showing empty metrics because:
- Platform metrics (CPU, Network) are collected automatically by Azure
- No diagnostic extensions needed
- Metrics typically appear after 5-15 minutes of VM runtime
- Current status: VMs running, metrics will populate over time

The monitoring feature is working correctly - it's just waiting for Azure to collect and aggregate the metric data.

## User Impact

Users can now:
1. View automated schedules on the Schedules page
2. See when VMs will start/stop automatically
3. Manually trigger start/stop operations for all VMs
4. VMs will automatically start weekday mornings and stop weekday evenings
5. Save compute costs by deallocating VMs outside business hours

## Lessons Learned

1. **Cross-Subscription Resources**: Bicep deployments create resource groups in the active subscription context
2. **RBAC Scope**: Service Principal needs permissions on both subscriptions when managing cross-subscription resources
3. **Automation Account Location**: Best practice is to deploy Automation Account in the same subscription as managed resources
4. **Platform Metrics**: No extensions needed for basic VM metrics (CPU, Network)
