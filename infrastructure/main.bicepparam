using './main.bicep'

// VM Portal Parameters

param location = 'swedencentral'
param swaLocation = 'westeurope'
param baseName = 'vmportal'
param environment = 'prod'

// Custom domain (set after initial deployment)
param customDomain = ''

// Target VM resource group
param vmSubscriptionId = '032fc479-8402-40fe-b342-1847e09d1e78'
param vmResourceGroup = 'rg-vms'
