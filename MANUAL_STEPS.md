# Manual Steps Required for VM Portal

## CRITICAL: Grant Managed Identity Permissions

The Static Web App has a System-Assigned Managed Identity enabled, but Azure CLI cannot assign roles across subscriptions.

**Managed Identity Principal ID:** `13278b8f-bb98-4b33-84d4-d6de879c6909`

### Steps to Complete in Azure Portal:

1. Navigate to Azure Portal: https://portal.azure.com
2. Go to subscription "Microsoft Azure Sponsorship 700 dollar" (ID: `abc661c5-b0eb-4f72-9c14-cf94e5914de6`)
3. Go to Resource Group: `rg-migrate-hyperv`
4. Click "Access control (IAM)"
5. Click "+ Add" → "Add role assignment"
6. Select role: **Virtual Machine Contributor**
7. Click "Next"
8. Click "+ Select members"
9. Search for: `swa-vmportalprod-fg3mvon3`
10. Select the Static Web App's managed identity
11. Click "Select"
12. Click "Review + assign"
13. Click "Review + assign" again

### Verification:

After completing the above steps, refresh https://vm.moderncloud.se and verify:
- No "crypto is not defined" error
- VM list shows both VMs (vm-hyd-dc1 and vm-hyd-sync01)
- Dashboard shows correct counts (2 igång - 0 stoppade or similar)

### Alternative: Using Azure CLI (if subscription context works):

```bash
az role assignment create \
  --assignee 13278b8f-bb98-4b33-84d4-d6de879c6909 \
  --role "Virtual Machine Contributor" \
  --scope "/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv"
```

## Issue Summary:

The API was failing with "crypto is not defined" because:
1. DefaultAzureCredential was trying to authenticate
2. No Managed Identity was configured
3. DefaultAzureCredential fell back to environment/browser-based auth which failed in Node.js runtime

**Fix:** Enable Managed Identity and grant it permissions to manage VMs.

## Current Status (Iteration 1 - Jan 3, 2026)

### What's Working ✅
- **Authentication**: User can log in with Entra ID
- **Authorization**: User has `vm-admin` role via Portal invitations
- **Frontend**: All pages load and render correctly
  - Dashboard (/)
  - Monitoring (/monitoring)
  - Schedules (/schedules)
- **Navigation**: All page transitions work
- **TypeScript**: Both frontend and API build without errors
- **Deployment**: GitHub Actions successfully deploys to Azure
- **Managed Identity**: Enabled on Static Web App (Principal ID: `13278b8f-bb98-4b33-84d4-d6de879c6909`)

### What's Blocked ⛔
All API endpoints fail with "crypto is not defined" error because Managed Identity lacks permissions:
- `/api/vms` - List VMs (500 error)
- `/api/vms/summary` - VM summary for monitoring (500 error)
- `/api/schedules` - List automation schedules (500 error)
- `/api/audit-log` - Audit log entries (500 error)

### Next Steps
1. **MANUAL REQUIRED**: Grant "Virtual Machine Contributor" role to Managed Identity via Azure Portal (see steps above)
2. After role granted, test:
   - [ ] VM list displays both VMs
   - [ ] Start/Stop/Restart operations work
   - [ ] Monitoring metrics load
   - [ ] Schedules list loads
   - [ ] Audit log displays entries
3. Continue with automated testing via Ralph Wiggum loop
