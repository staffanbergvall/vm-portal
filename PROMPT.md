# VM Portal - Production Readiness Tasks

## Context
VM Management Portal för Azure VMs med Entra ID autentisering, VM power operations, scheduling, monitoring och audit log.

**Deployed URL:** https://vm.moderncloud.se
**Subscription:** Microsoft Azure Sponsorship 700 dollar (`abc661c5-b0eb-4f72-9c14-cf94e5914de6`)
**Resource Group:** rg-migrate-hyperv
**VMs:**
- vm-hyd-dc1 (Running, Standard_D2s_v3, Windows)
- vm-hyd-sync01 (Running, Standard_D2s_v3, Windows)

**Recent Changes:**
- ✅ Switched to built-in AAD provider (no custom identityProviders)
- ✅ User has vm-admin role via Portal invitations
- ✅ Application Settings configured: VM_SUBSCRIPTION_ID, VM_RESOURCE_GROUP
- ❓ Need to verify all functionality works end-to-end

## Your Task
Test and fix ALL functionality in the VM Portal to ensure production readiness. Work systematically through each area.

## Definition of Done

### 1. VM List Display ✓
- [ ] Navigate to https://vm.moderncloud.se
- [ ] Dashboard loads without errors
- [ ] Both VMs (vm-hyd-dc1, vm-hyd-sync01) are visible
- [ ] VM cards show: Name, Status, Size, Location
- [ ] Power state displays correctly (Running/Stopped/etc)
- [ ] No 500 errors in browser console
- [ ] No authentication errors

### 2. VM Power Operations ✓
- [ ] Start button works for stopped VMs
- [ ] Stop button works for running VMs
- [ ] Restart button works for running VMs
- [ ] Loading states display during operations
- [ ] Success/error messages appear after operations
- [ ] VM status updates after operation completes
- [ ] Operations work for BOTH VMs

### 3. VM Scheduling ✓
- [ ] Navigate to Schedules page/section
- [ ] Page loads without errors
- [ ] Can view existing schedules (if any)
- [ ] Can create new schedule with:
  - VM selection (both VMs selectable)
  - Action (Start/Stop)
  - Schedule time (daily/weekly)
  - Timezone selection
- [ ] Schedule saves successfully
- [ ] Schedule appears in list after creation
- [ ] Can edit existing schedule
- [ ] Can delete schedule
- [ ] Azure Automation schedules created correctly

### 4. Monitoring Dashboard ✓
- [ ] Navigate to Monitoring page/section
- [ ] Page loads without errors
- [ ] Can select VM from dropdown (both VMs)
- [ ] Metrics display for selected VM:
  - CPU percentage
  - Memory usage
  - Disk read/write
  - Network in/out
- [ ] Time range selector works (1h, 24h, 7d, 30d)
- [ ] Charts render correctly
- [ ] Data is accurate (no mock data)
- [ ] Auto-refresh works (if implemented)

### 5. Audit Log ✓
- [ ] Navigate to Audit Log page/section
- [ ] Page loads without errors
- [ ] Recent operations are logged with:
  - Timestamp
  - User (staffan.bergvall@moderncloud.se)
  - VM name
  - Action (Start/Stop/Restart)
  - Status (Success/Failed)
- [ ] Can filter by VM
- [ ] Can filter by date range
- [ ] Can filter by action type
- [ ] Pagination works (if >100 entries)
- [ ] Log entries persist across sessions

### 6. Error Handling ✓
- [ ] Graceful error messages for API failures
- [ ] Network error handling
- [ ] Permission denied errors (if non-admin tries access)
- [ ] No unhandled promise rejections in console
- [ ] 403.html shows for unauthorized users
- [ ] 401 redirects to login correctly

### 7. Security & Performance ✓
- [ ] CSP headers block unauthorized resources
- [ ] No sensitive data in browser console
- [ ] No API keys or secrets exposed
- [ ] HTTPS enforced
- [ ] Session timeout works
- [ ] Logout button works
- [ ] Page loads in <3 seconds
- [ ] API responses in <2 seconds
- [ ] No memory leaks during normal usage

### 8. Code Quality ✓
- [ ] No TypeScript errors (`npm run build` succeeds in both frontend/ and api/)
- [ ] No ESLint warnings (if configured)
- [ ] Git status is clean (or only intentional changes)
- [ ] All TODO comments addressed or documented
- [ ] Environment variables documented in README

## Testing Approach

1. **Start with VM List** - This is the foundation. If VMs don't show, fix that first.
2. **Test Power Operations** - Core functionality, must work reliably.
3. **Verify Scheduling** - Test create/edit/delete flow end-to-end.
4. **Check Monitoring** - Ensure metrics are pulling real data from Azure.
5. **Review Audit Log** - Verify all operations are logged correctly.
6. **Test Error Cases** - Try operations that should fail gracefully.
7. **Security Check** - Verify permissions and CSP are working.
8. **Code Quality** - Build project and fix any TypeScript/lint errors.

## How to Test

### Browser Testing (REQUIRED - Use Chrome MCP):
```
IMPORTANT: You MUST use Chrome browser automation tools to test the live site.

1. Start by calling: mcp__claude-in-chrome__tabs_context_mcp with createIfEmpty: true
2. Create new tab: mcp__claude-in-chrome__tabs_create_mcp
3. Navigate to site: mcp__claude-in-chrome__navigate with url: "https://vm.moderncloud.se"
4. Take screenshots: mcp__claude-in-chrome__computer with action: "screenshot"
5. Read page content: mcp__claude-in-chrome__read_page to verify VM list
6. Check console errors: mcp__claude-in-chrome__read_console_messages
7. Click buttons: mcp__claude-in-chrome__computer with action: "left_click"
8. Verify functionality by actually interacting with the deployed site

DO NOT skip browser testing - you must visually verify each feature works!
```

### API Testing:
```bash
# List Application Settings
az staticwebapp appsettings list --name swa-vmportalprod-fg3mvon3 --resource-group rg-vmportal

# Check deployment status
az staticwebapp show --name swa-vmportalprod-fg3mvon3 --resource-group rg-vmportal --query "defaultHostname"
```

### Code Testing:
```bash
# Build frontend
cd frontend
npm run build

# Build API
cd ../api
npm run build
```

## Completion Signal

When ALL items in Definition of Done are checked and verified working:

<promise>VM-PORTAL-PRODUCTION-READY</promise>

## Important Notes

- **Don't skip steps** - Test each checkbox systematically
- **Fix issues immediately** - If something fails, fix it before moving on
- **Document fixes** - Update CLAUDE.md with any issues found and how you fixed them
- **Commit often** - Make small, focused commits as you fix issues
- **Test in browser** - Don't assume code changes work, verify in deployed site
- **Check logs** - Use Azure Portal to check Function App logs if API fails
- **Wait for deployments** - GitHub Actions takes ~2-3 minutes, wait for completion

## If You Get Stuck

1. Check browser console for JavaScript errors
2. Check Network tab for failed API calls
3. Check Azure Portal → Static Web App → Functions → Monitor for API errors
4. Check GitHub Actions for deployment failures
5. Review CLAUDE.md for similar issues resolved previously
6. Use `az staticwebapp appsettings list` to verify configuration
7. Read Microsoft Learn documentation for Azure Static Web Apps best practices

---

**Remember:** The goal is a fully functional, production-ready VM Portal that staffan.bergvall@moderncloud.se can use reliably to manage VMs.
