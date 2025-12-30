// RBAC Configuration for VM Portal
// Assigns VM Power Operator permissions to the Function App Managed Identity
// Deploy this to the target VM subscription/resource group

@description('Principal ID of the Function App managed identity')
param functionAppPrincipalId string

@description('Subscription ID containing the VMs')
param vmSubscriptionId string = subscription().subscriptionId

@description('Resource group containing the VMs')
param vmResourceGroup string

// Custom role definition: VM Power Operator (minimal permissions)
var vmPowerOperatorRoleId = guid(subscription().id, 'vm-power-operator')

resource vmPowerOperatorRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: vmPowerOperatorRoleId
  properties: {
    roleName: 'VM Power Operator'
    description: 'Can start, stop, and deallocate VMs. Minimal permissions for VM power management.'
    type: 'CustomRole'
    permissions: [
      {
        actions: [
          'Microsoft.Compute/virtualMachines/read'
          'Microsoft.Compute/virtualMachines/instanceView/read'
          'Microsoft.Compute/virtualMachines/start/action'
          'Microsoft.Compute/virtualMachines/deallocate/action'
          'Microsoft.Compute/virtualMachines/powerOff/action'
          'Microsoft.Resources/subscriptions/resourceGroups/read'
        ]
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
    assignableScopes: [
      '/subscriptions/${vmSubscriptionId}/resourceGroups/${vmResourceGroup}'
    ]
  }
}

// Assign the custom role to the Function App managed identity
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, functionAppPrincipalId, vmPowerOperatorRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: vmPowerOperatorRole.id
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Output
output roleAssignmentId string = roleAssignment.id
output customRoleId string = vmPowerOperatorRole.id
