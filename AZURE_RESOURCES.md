# Azure Resources - Subscription and Location Mapping

## Cross-Subscription Architecture

This VM Portal application spans **two Azure subscriptions**:

### 1. Static Web App Subscription

**Subscription:** Visual Studio Enterprise Subscription – MPN
**Subscription ID:** `5280b014-4b52-47a6-b447-00678b179005`

**Resources:**
- **Static Web App:** `swa-vmportalprod-fg3mvon3`
- **Resource Group:** `rg-vmportal`
- **Location:** West Europe
- **Default Hostname:** brave-moss-0fbf9ae03.6.azurestaticapps.net
- **Custom Domain:** https://vm.moderncloud.se
- **Managed Identity Principal ID:** `13278b8f-bb98-4b33-84d4-d6de879c6909`

### 2. Virtual Machines Subscription

**Subscription:** Microsoft Azure Sponsorship 700 dollar
**Subscription ID:** `abc661c5-b0eb-4f72-9c14-cf94e5914de6`

**Resources:**
- **Resource Group:** `rg-migrate-hyperv`
- **Location:** (Same region as VMs)

**Virtual Machines:**
1. `vm-hyd-dc1`
   - Size: Standard_D2s_v3
   - OS: Windows

2. `vm-hyd-sync01`
   - Size: Standard_D2s_v3
   - OS: Windows

## Cross-Subscription Access

The Static Web App's Managed Identity needs permission to manage VMs in a **different subscription**.

**Role Assignment:**
- **Principal:** Managed Identity `13278b8f-bb98-4b33-84d4-d6de879c6909` (from SWA)
- **Role:** Virtual Machine Contributor (`9980e02c-c2be-4d73-94e8-173b1dc7cf3c`)
- **Scope:** `/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv`
- **Assignment ID:** `c548939e-20a9-4a22-990f-32155d1d0f87`

## Application Settings

**Environment Variables in SWA:**
```bash
VM_SUBSCRIPTION_ID=abc661c5-b0eb-4f72-9c14-cf94e5914de6
VM_RESOURCE_GROUP=rg-migrate-hyperv
```

## Why Cross-Subscription?

The Static Web App is deployed in the Visual Studio Enterprise subscription (likely for dev/test benefits), while the production VMs are in the Azure Sponsorship subscription. This requires:

1. **Managed Identity** enabled on the SWA
2. **Cross-subscription RBAC** role assignment
3. **Azure REST API** for role management (Azure CLI has limitations with cross-subscription assignments)

## Verification Commands

### List Static Web Apps (in SWA subscription):
```bash
az account set -s 5280b014-4b52-47a6-b447-00678b179005
az staticwebapp list --query "[].{name:name,resourceGroup:resourceGroup}" -o table
```

### List VMs (in VM subscription):
```bash
az account set -s abc661c5-b0eb-4f72-9c14-cf94e5914de6
az vm list --resource-group rg-migrate-hyperv --query "[].{name:name,location:location,vmSize:hardwareProfile.vmSize}" -o table
```

### Verify Role Assignment:
```bash
az rest --method GET \
  --url "https://management.azure.com/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01&\$filter=principalId eq '13278b8f-bb98-4b33-84d4-d6de879c6909'" \
  --query "value[].{roleDefinitionId:properties.roleDefinitionId,principalId:properties.principalId}"
```

## Known Issues

### Issue: Azure CLI Cross-Subscription Role Assignment Fails

**Error:**
```
(MissingSubscription) The request did not have a subscription or a valid tenant level resource provider.
```

**Solution:** Use Azure REST API directly instead of `az role assignment create`:
```bash
az rest --method PUT \
  --url "https://management.azure.com/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/resourceGroups/rg-migrate-hyperv/providers/Microsoft.Authorization/roleAssignments/<GUID>?api-version=2022-04-01" \
  --body '{"properties":{"roleDefinitionId":"/subscriptions/abc661c5-b0eb-4f72-9c14-cf94e5914de6/providers/Microsoft.Authorization/roleDefinitions/9980e02c-c2be-4d73-94e8-173b1dc7cf3c","principalId":"13278b8f-bb98-4b33-84d4-d6de879c6909","principalType":"ServicePrincipal"}}'
```
