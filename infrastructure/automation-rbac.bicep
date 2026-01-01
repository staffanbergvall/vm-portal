// RBAC for VM Portal Automation Account
// Grants VM Power Operator permissions to the Automation Account's Managed Identity

@description('Principal ID of the Automation Account Managed Identity')
param automationAccountPrincipalId string

@description('Name of the Automation Account (for unique GUID generation)')
param automationAccountName string

// VM Power Operator - Custom role for VM power operations
// This role should be created at subscription level first
// Alternatively, use built-in 'Virtual Machine Contributor' role
var vmContributorRoleId = '9980e02c-c2be-4d73-94e8-173b1dc7cf3c'  // Virtual Machine Contributor

// Role assignment for VM operations
resource vmRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(automationAccountPrincipalId, vmContributorRoleId, resourceGroup().id, automationAccountName)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', vmContributorRoleId)
    principalId: automationAccountPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output roleAssignmentId string = vmRoleAssignment.id
