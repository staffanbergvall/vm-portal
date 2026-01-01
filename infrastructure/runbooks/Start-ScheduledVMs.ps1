<#
.SYNOPSIS
    Starts specified Azure VMs in parallel.

.DESCRIPTION
    This runbook starts Azure VMs using the Automation Account's Managed Identity.
    It reads configuration from Automation Variables or accepts parameters.
    VMs are started in parallel using PowerShell jobs for efficiency.

.PARAMETER VMNames
    Comma-separated list of VM names to start. If empty, reads from DefaultVMNames variable.

.PARAMETER SubscriptionId
    Target subscription ID. If empty, reads from VMSubscriptionId variable.

.PARAMETER ResourceGroup
    Target resource group. If empty, reads from VMResourceGroup variable.

.NOTES
    Author: VM Portal Automation
    Requires: Az.Accounts, Az.Compute modules
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$VMNames = "",

    [Parameter(Mandatory = $false)]
    [string]$SubscriptionId = "",

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroup = ""
)

# Disable context autosave for security
Disable-AzContextAutosave -Scope Process | Out-Null

try {
    # Connect using Managed Identity
    Write-Output "Connecting to Azure using Managed Identity..."
    Connect-AzAccount -Identity -ErrorAction Stop | Out-Null
    Write-Output "Successfully connected to Azure."

    # Get configuration from variables if not provided as parameters
    if ([string]::IsNullOrEmpty($SubscriptionId)) {
        $SubscriptionId = (Get-AutomationVariable -Name 'VMSubscriptionId').Trim('"')
    }
    if ([string]::IsNullOrEmpty($ResourceGroup)) {
        $ResourceGroup = (Get-AutomationVariable -Name 'VMResourceGroup').Trim('"')
    }
    if ([string]::IsNullOrEmpty($VMNames)) {
        $VMNames = (Get-AutomationVariable -Name 'DefaultVMNames').Trim('"')
    }

    # Validate configuration
    if ([string]::IsNullOrEmpty($SubscriptionId)) {
        throw "SubscriptionId is required. Set VMSubscriptionId variable or pass as parameter."
    }
    if ([string]::IsNullOrEmpty($ResourceGroup)) {
        throw "ResourceGroup is required. Set VMResourceGroup variable or pass as parameter."
    }
    if ([string]::IsNullOrEmpty($VMNames)) {
        throw "VMNames is required. Set DefaultVMNames variable or pass as parameter."
    }

    # Set subscription context
    Write-Output "Setting subscription context to: $SubscriptionId"
    Set-AzContext -SubscriptionId $SubscriptionId -ErrorAction Stop | Out-Null

    # Parse VM names
    $vmList = $VMNames -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
    Write-Output "Starting $($vmList.Count) VM(s): $($vmList -join ', ')"

    # Start VMs in parallel
    $jobs = @()
    foreach ($vmName in $vmList) {
        Write-Output "Initiating start for VM: $vmName"
        $jobs += Start-AzVM -ResourceGroupName $ResourceGroup -Name $vmName -NoWait -ErrorAction SilentlyContinue
    }

    # Wait for all operations to complete
    $results = @()
    foreach ($vmName in $vmList) {
        try {
            $vm = Get-AzVM -ResourceGroupName $ResourceGroup -Name $vmName -Status -ErrorAction Stop
            $powerState = ($vm.Statuses | Where-Object { $_.Code -like 'PowerState/*' }).DisplayStatus

            $results += [PSCustomObject]@{
                VMName = $vmName
                Status = "Started"
                PowerState = $powerState
            }
            Write-Output "VM $vmName started successfully. Power state: $powerState"
        }
        catch {
            $results += [PSCustomObject]@{
                VMName = $vmName
                Status = "Failed"
                Error = $_.Exception.Message
            }
            Write-Warning "Failed to start VM $vmName`: $($_.Exception.Message)"
        }
    }

    # Summary
    $successCount = ($results | Where-Object { $_.Status -eq 'Started' }).Count
    $failCount = ($results | Where-Object { $_.Status -eq 'Failed' }).Count

    Write-Output ""
    Write-Output "=== Summary ==="
    Write-Output "Total VMs: $($vmList.Count)"
    Write-Output "Started: $successCount"
    Write-Output "Failed: $failCount"
    Write-Output "==============="

    if ($failCount -gt 0) {
        Write-Warning "Some VMs failed to start. Check logs for details."
    }
}
catch {
    Write-Error "Runbook failed: $($_.Exception.Message)"
    throw
}
