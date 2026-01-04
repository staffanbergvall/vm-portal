# Manual Role Assignment Required

## Current Situation

✅ **Good News**: The VM Portal is now successfully:
- Authenticating users with Entra ID
- Running on Node.js 20
- Using Service Principal authentication (ClientSecretCredential)
- Connecting to Azure successfully

⛔ **Blocker**: The Service Principal needs "Virtual Machine Contributor" role to read and manage VMs.

**Error visible on https://vm.moderncloud.se**:
```
The client '0bd7aea6-00f0-4e17-8e20-eae680740f70' with object id '8cd63878-9d61-459f-ad17-1231bc054017'
does not have authorization to perform action 'Microsoft.Compute/virtualMachines/read'...
```

## Why This Manual Step is Needed

- Azure CLI on this system has DLL import errors and cannot execute commands
- Azure MCP tools don't support creating role assignments (only listing)
- This is a one-time setup - once done, the portal will be fully functional

## Service Principal Details

You need to grant permissions to **this specific Service Principal**:

- **Application (Client) ID**: `0bd7aea6-00f0-4e17-8e20-eae680740f70`
- **Object ID (Principal ID)**: `8cd63878-9d61-459f-ad17-1231bc054017`

**Important**: This is the **Service Principal**, NOT the Managed Identity we used in iteration 1!

## Step-by-Step Instructions

### Option 1: Azure Portal (Recommended)

1. **Navigate to Azure Portal**: https://portal.azure.com

2. **Go to the target subscription**:
   - Search for "Subscriptions" in the top search bar
   - Select: **"Microsoft Azure Sponsorship 700 dollar"**
   - (Subscription ID: `abc661c5-b0eb-4f72-9c14-cf94e5914de6`)

3. **Navigate to the resource group**:
   - In the subscription overview, click on "Resource groups" in the left menu
   - Select: **"rg-migrate-hyperv"**

4. **Open Access Control (IAM)**:
   - In the left menu of the resource group, click **"Access control (IAM)"**

5. **Add role assignment**:
   - Click **"+ Add"** → **"Add role assignment"**

6. **Select the role**:
   - In the "Role" tab, search for: **"Virtual Machine Contributor"**
   - Select it
   - Click **"Next"**

7. **Select the Service Principal**:
   - In the "Members" tab, ensure "Assign access to" is set to: **"User, group, or service principal"**
   - Click **"+ Select members"**
   - In the search box, paste the **Object ID**: `8cd63878-9d61-459f-ad17-1231bc054017`
     - (Alternative: search by Application ID: `0bd7aea6-00f0-4e17-8e20-eae680740f70`)
   - The Service Principal should appear in the results
   - Click on it to select it
   - Click **"Select"** at the bottom

8. **Review and assign**:
   - Click **"Review + assign"**
   - Review the details (should show Virtual Machine Contributor role for the Service Principal on rg-migrate-hyperv)
   - Click **"Review + assign"** again to confirm

9. **Wait for propagation** (30-60 seconds)

### Option 2: Azure CLI (If your system's Azure CLI works)

```bash
az role assignment create \
  --assignee 8cd63878-9d61-459f-ad17-1231bc054017 \
  --role "Virtual Machine Contributor" \
  --scope "/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv"
```

**Note**: This system's Azure CLI has DLL errors, so Portal is required.

### Option 3: Azure PowerShell

```powershell
New-AzRoleAssignment `
  -ObjectId "8cd63878-9d61-459f-ad17-1231bc054017" `
  -RoleDefinitionName "Virtual Machine Contributor" `
  -Scope "/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv"
```

## Verification Steps

After completing the role assignment:

1. **Hard refresh the portal** (to clear any cached errors):
   - Navigate to: https://vm.moderncloud.se
   - Press: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)

2. **Expected Results** (Success!):
   - ❌ No red error banner
   - ✅ Dashboard shows: "2 igång - 0 stoppade" (or current VM states)
   - ✅ VM cards display:
     - **vm-hyd-dc1**: Windows Server, Standard_D2s_v3, swedencentral
     - **vm-hyd-sync01**: Windows Server, Standard_D2s_v3, swedencentral
   - ✅ Power state indicators work (green for running, red for stopped)
   - ✅ Start/Stop/Restart buttons are enabled

3. **Test the API directly** (optional):
   ```bash
   curl https://vm.moderncloud.se/api/vms
   ```
   Should return JSON with both VMs instead of an error.

## What Happens Next

Once you've completed this manual step and verified it works:

1. **Ralph Wiggum loop will continue automatically** with the same prompt
2. **All pending tests will execute**:
   - VM List Display
   - VM Power Operations (Start/Stop/Restart)
   - VM Scheduling
   - Monitoring Dashboard
   - Audit Log
   - Error Handling
   - Security & Performance
3. **Portal will be production-ready**

## Troubleshooting

### "I can't find the Service Principal"

- Make sure you're searching in the **"rg-migrate-hyperv" resource group** in the **correct subscription**
- Try searching by Object ID: `8cd63878-9d61-459f-ad17-1231bc054017`
- Try searching by Application ID: `0bd7aea6-00f0-4e17-8e20-eae680740f70`
- Make sure "Assign access to" is set to "User, group, or service principal" (not just "User")

### "The portal still shows an error after assignment"

- Wait 1-2 minutes for Azure RBAC propagation
- Do a hard refresh: Ctrl+Shift+R
- Clear browser cache and try again
- Check that the role was assigned to the **correct resource group** (rg-migrate-hyperv)

### "I'm not sure if it worked"

Run this command to verify the role assignment:
```bash
az role assignment list --scope "/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv" --assignee 8cd63878-9d61-459f-ad17-1231bc054017
```

## Estimated Time

- **Manual step**: 5-10 minutes
- **RBAC propagation**: 30-60 seconds
- **Remaining automated testing**: 1-2 Ralph iterations (~10-20 minutes)
- **Total to production ready**: ~30 minutes

## Summary

You just need to grant one permission via Azure Portal, then everything will work! 🎉

**What to grant**: "Virtual Machine Contributor" role
**To whom**: Service Principal with Object ID `8cd63878-9d61-459f-ad17-1231bc054017`
**Where**: Resource group "rg-migrate-hyperv" in subscription "abc661c5-b0eb-4f72-9c14-cf94e5914de6"
