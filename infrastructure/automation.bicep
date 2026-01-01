// VM Portal - Azure Automation for VM Scheduling
// Provides scheduled start/stop of VMs using Azure Automation runbooks

@description('Location for all resources')
param location string = 'swedencentral'

@description('Base name for resources')
param baseName string = 'vmportal'

@description('Environment suffix')
param environment string = 'prod'

@description('Unique suffix for globally unique names')
param uniqueSuffix string = uniqueString(resourceGroup().id)

@description('Target subscription ID for VM operations')
param vmSubscriptionId string

@description('Target resource group for VM operations')
param vmResourceGroup string

@description('Default VMs to include in schedules (comma-separated)')
param defaultVmNames string = ''

@description('Weekday start time (HH:mm)')
param weekdayStartTime string = '07:00'

@description('Weekday stop time (HH:mm)')
param weekdayStopTime string = '18:00'

@description('Time zone for schedules')
param timeZone string = 'W. Europe Standard Time'

@description('Schedule start date (ISO format, defaults to tomorrow)')
param scheduleStartDate string = dateTimeAdd(utcNow('yyyy-MM-dd'), 'P1D')

// Resource naming
var automationAccountName = 'aa-${baseName}${environment}-${take(uniqueSuffix, 8)}'

// Azure Automation Account with System-assigned Managed Identity
resource automationAccount 'Microsoft.Automation/automationAccounts@2023-11-01' = {
  name: automationAccountName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    sku: {
      name: 'Basic'
    }
    publicNetworkAccess: true
    encryption: {
      keySource: 'Microsoft.Automation'
    }
  }
  tags: {
    environment: environment
    application: 'vm-portal'
    purpose: 'vm-scheduling'
  }
}

// Runbook: Start-ScheduledVMs
resource startVMsRunbook 'Microsoft.Automation/automationAccounts/runbooks@2023-11-01' = {
  parent: automationAccount
  name: 'Start-ScheduledVMs'
  location: location
  properties: {
    runbookType: 'PowerShell'
    description: 'Starts specified VMs in parallel. Used for scheduled VM startup.'
    logProgress: true
    logVerbose: false
  }
  tags: {
    environment: environment
    purpose: 'vm-scheduling'
  }
}

// Runbook: Stop-ScheduledVMs
resource stopVMsRunbook 'Microsoft.Automation/automationAccounts/runbooks@2023-11-01' = {
  parent: automationAccount
  name: 'Stop-ScheduledVMs'
  location: location
  properties: {
    runbookType: 'PowerShell'
    description: 'Stops (deallocates) specified VMs in parallel. Used for scheduled VM shutdown.'
    logProgress: true
    logVerbose: false
  }
  tags: {
    environment: environment
    purpose: 'vm-scheduling'
  }
}

// Automation Variables for configuration
resource vmSubscriptionVar 'Microsoft.Automation/automationAccounts/variables@2023-11-01' = {
  parent: automationAccount
  name: 'VMSubscriptionId'
  properties: {
    description: 'Target subscription ID for VM operations'
    value: '"${vmSubscriptionId}"'
    isEncrypted: false
  }
}

resource vmResourceGroupVar 'Microsoft.Automation/automationAccounts/variables@2023-11-01' = {
  parent: automationAccount
  name: 'VMResourceGroup'
  properties: {
    description: 'Target resource group for VM operations'
    value: '"${vmResourceGroup}"'
    isEncrypted: false
  }
}

resource defaultVmNamesVar 'Microsoft.Automation/automationAccounts/variables@2023-11-01' = {
  parent: automationAccount
  name: 'DefaultVMNames'
  properties: {
    description: 'Default VM names for scheduled operations (comma-separated)'
    value: '"${defaultVmNames}"'
    isEncrypted: false
  }
}

// Schedule: Weekday Morning Start
resource weekdayStartSchedule 'Microsoft.Automation/automationAccounts/schedules@2023-11-01' = {
  parent: automationAccount
  name: 'WeekdayMorningStart'
  properties: {
    description: 'Start VMs every weekday morning'
    startTime: '2026-01-05T${weekdayStartTime}:00+01:00'
    frequency: 'Week'
    interval: 1
    timeZone: timeZone
    advancedSchedule: {
      weekDays: [
        'Monday'
        'Tuesday'
        'Wednesday'
        'Thursday'
        'Friday'
      ]
    }
  }
}

// Schedule: Weekday Evening Stop
resource weekdayStopSchedule 'Microsoft.Automation/automationAccounts/schedules@2023-11-01' = {
  parent: automationAccount
  name: 'WeekdayEveningStop'
  properties: {
    description: 'Stop VMs every weekday evening'
    startTime: '2026-01-05T${weekdayStopTime}:00+01:00'
    frequency: 'Week'
    interval: 1
    timeZone: timeZone
    advancedSchedule: {
      weekDays: [
        'Monday'
        'Tuesday'
        'Wednesday'
        'Thursday'
        'Friday'
      ]
    }
  }
}

// NOTE: Job Schedules must be created after runbooks are published
// Use Azure CLI or Portal to link runbooks to schedules:
// az automation job-schedule create --automation-account-name <name> --resource-group rg-vmportal \
//   --runbook-name Start-ScheduledVMs --schedule-name WeekdayMorningStart

// Outputs
output automationAccountName string = automationAccount.name
output automationAccountId string = automationAccount.id
output automationAccountPrincipalId string = automationAccount.identity.principalId
output startRunbookName string = startVMsRunbook.name
output stopRunbookName string = stopVMsRunbook.name
output weekdayStartScheduleName string = weekdayStartSchedule.name
output weekdayStopScheduleName string = weekdayStopSchedule.name
