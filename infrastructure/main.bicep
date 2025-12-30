// VM Management Portal Infrastructure
// Deploys: Static Web App (Standard), Function App (Consumption), Storage Account, Application Insights

@description('Location for all resources')
param location string = 'swedencentral'

@description('Location for Static Web App (limited regions)')
param swaLocation string = 'westeurope'

@description('Base name for resources')
param baseName string = 'vmportal'

@description('Environment suffix')
param environment string = 'prod'

@description('Entra ID tenant ID')
param tenantId string = subscription().tenantId

@description('Custom domain for the portal (e.g., vm.moderncloud.se)')
param customDomain string = ''

@description('Target subscription ID for VM operations')
param vmSubscriptionId string

@description('Target resource group for VM operations')
param vmResourceGroup string

// Unique suffix for globally unique names
var uniqueSuffix = uniqueString(resourceGroup().id)
var resourcePrefix = '${baseName}${environment}'

// Storage Account for Azure Functions
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'st${take(baseName, 8)}${take(uniqueSuffix, 10)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${resourcePrefix}-${take(uniqueSuffix, 8)}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
  tags: {
    environment: environment
    application: 'vm-portal'
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${resourcePrefix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    RetentionInDays: 30
  }
}

// App Service Plan for Azure Functions (Consumption Y1)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'asp-${resourcePrefix}'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Linux
  }
}

// Azure Function App (Linked Backend for SWA)
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'func-${resourcePrefix}-${take(uniqueSuffix, 8)}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'WEBSITE_CONTENTSHARE', value: toLower('func-${resourcePrefix}') }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'VM_SUBSCRIPTION_ID', value: vmSubscriptionId }
        { name: 'VM_RESOURCE_GROUP', value: vmResourceGroup }
        { name: 'AZURE_TENANT_ID', value: tenantId }
      ]
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      cors: {
        allowedOrigins: [
          'https://portal.azure.com'
        ]
      }
    }
  }
}

// Static Web App (Standard plan for custom auth + linked backend)
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'swa-${resourcePrefix}-${take(uniqueSuffix, 8)}'
  location: swaLocation
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

// Link Function App to Static Web App as backend
resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2023-01-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: functionApp.id
    region: location
  }
}

// Custom domain (if provided)
resource customDomainBinding 'Microsoft.Web/staticSites/customDomains@2023-01-01' = if (!empty(customDomain)) {
  parent: staticWebApp
  name: customDomain
  properties: {}
}

// Outputs
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output functionAppName string = functionApp.name
output functionAppPrincipalId string = functionApp.identity.principalId
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
output vmSubscriptionId string = vmSubscriptionId
output vmResourceGroup string = vmResourceGroup
