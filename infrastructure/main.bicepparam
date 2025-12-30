using './main.bicep'

// VM Portal Parameters

param location = 'swedencentral'
param swaLocation = 'westeurope'
param baseName = 'vmportal'
param environment = 'prod'

// Custom domain (set after initial deployment)
param customDomain = ''

// Target VM resource group
param vmSubscriptionId = 'abc661c5-b0eb-4f72-9c14-cf94e5914de6'
param vmResourceGroup = 'rg-migrate-hyperv'
