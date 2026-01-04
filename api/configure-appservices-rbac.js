/**
 * Configure RBAC permissions for App Services management
 * Grants Reader role on all subscriptions and Website Contributor on resource groups with App Services
 */

const { ClientSecretCredential } = require('@azure/identity');
const { SubscriptionClient } = require('@azure/arm-subscriptions');
const { WebSiteManagementClient } = require('@azure/arm-appservice');
const { AuthorizationManagementClient } = require('@azure/arm-authorization');

// Static Web App Managed Identity Principal ID
const PRINCIPAL_ID = '13278b8f-bb98-4b33-84d4-d6de879c6909';

// Role Definition IDs (these are fixed GUIDs in Azure)
const READER_ROLE_ID = 'acdd72a7-3385-48ef-bd42-f606fba81ae7';
const WEBSITE_CONTRIBUTOR_ROLE_ID = 'de139f84-1756-47ae-9be6-808fbbe84772';

async function getCredential() {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error('Missing Azure credentials in environment variables');
    }

    return new ClientSecretCredential(tenantId, clientId, clientSecret);
}

function extractResourceGroup(resourceId) {
    const match = resourceId.match(/\/resourceGroups\/([^\/]+)\//i);
    return match ? match[1] : null;
}

async function grantReaderOnAllSubscriptions(credential) {
    console.log('\n=== Granting Reader role on all subscriptions ===');

    const subscriptionClient = new SubscriptionClient(credential);
    const subscriptions = subscriptionClient.subscriptions.list();

    const results = [];

    for await (const sub of subscriptions) {
        if (!sub.subscriptionId || !sub.displayName) continue;

        console.log(`\nProcessing subscription: ${sub.displayName} (${sub.subscriptionId})`);

        try {
            const authClient = new AuthorizationManagementClient(credential, sub.subscriptionId);
            const scope = `/subscriptions/${sub.subscriptionId}`;
            const roleDefinitionId = `/subscriptions/${sub.subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${READER_ROLE_ID}`;

            // Check if role assignment already exists
            const existingAssignments = authClient.roleAssignments.listForScope(scope, {
                filter: `principalId eq '${PRINCIPAL_ID}'`
            });

            let alreadyHasReader = false;
            for await (const assignment of existingAssignments) {
                if (assignment.roleDefinitionId === roleDefinitionId) {
                    alreadyHasReader = true;
                    console.log(`  ✓ Already has Reader role`);
                    break;
                }
            }

            if (!alreadyHasReader) {
                // Create role assignment
                const assignmentName = require('crypto').randomUUID();
                await authClient.roleAssignments.create(scope, assignmentName, {
                    roleDefinitionId: roleDefinitionId,
                    principalId: PRINCIPAL_ID,
                    principalType: 'ServicePrincipal'
                });
                console.log(`  ✓ Granted Reader role`);
            }

            results.push({ subscription: sub.displayName, status: 'success', role: 'Reader' });
        } catch (error) {
            console.error(`  ✗ Failed: ${error.message}`);
            results.push({ subscription: sub.displayName, status: 'failed', error: error.message });
        }
    }

    return results;
}

async function grantWebsiteContributorOnResourceGroups(credential) {
    console.log('\n=== Granting Website Contributor on resource groups with App Services ===');

    const subscriptionClient = new SubscriptionClient(credential);
    const subscriptions = subscriptionClient.subscriptions.list();

    const results = [];
    const resourceGroupsWithAppServices = new Map();

    // First, find all resource groups with App Services
    for await (const sub of subscriptions) {
        if (!sub.subscriptionId || !sub.displayName) continue;

        try {
            const appServiceClient = new WebSiteManagementClient(credential, sub.subscriptionId);
            const sites = appServiceClient.webApps.list();

            for await (const site of sites) {
                if (!site.id) continue;
                const rg = extractResourceGroup(site.id);
                if (rg) {
                    const key = `${sub.subscriptionId}/${rg}`;
                    if (!resourceGroupsWithAppServices.has(key)) {
                        resourceGroupsWithAppServices.set(key, {
                            subscriptionId: sub.subscriptionId,
                            subscriptionName: sub.displayName,
                            resourceGroup: rg
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(`  ⚠ Could not list App Services in ${sub.displayName}: ${error.message}`);
        }
    }

    console.log(`\nFound ${resourceGroupsWithAppServices.size} resource groups with App Services`);

    // Grant Website Contributor on each resource group
    for (const [key, info] of resourceGroupsWithAppServices) {
        console.log(`\nProcessing: ${info.subscriptionName} / ${info.resourceGroup}`);

        try {
            const authClient = new AuthorizationManagementClient(credential, info.subscriptionId);
            const scope = `/subscriptions/${info.subscriptionId}/resourceGroups/${info.resourceGroup}`;
            const roleDefinitionId = `/subscriptions/${info.subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${WEBSITE_CONTRIBUTOR_ROLE_ID}`;

            // Check if role assignment already exists
            const existingAssignments = authClient.roleAssignments.listForScope(scope, {
                filter: `principalId eq '${PRINCIPAL_ID}'`
            });

            let alreadyHasRole = false;
            for await (const assignment of existingAssignments) {
                if (assignment.roleDefinitionId === roleDefinitionId) {
                    alreadyHasRole = true;
                    console.log(`  ✓ Already has Website Contributor role`);
                    break;
                }
            }

            if (!alreadyHasRole) {
                // Create role assignment
                const assignmentName = require('crypto').randomUUID();
                await authClient.roleAssignments.create(scope, assignmentName, {
                    roleDefinitionId: roleDefinitionId,
                    principalId: PRINCIPAL_ID,
                    principalType: 'ServicePrincipal'
                });
                console.log(`  ✓ Granted Website Contributor role`);
            }

            results.push({
                subscription: info.subscriptionName,
                resourceGroup: info.resourceGroup,
                status: 'success',
                role: 'Website Contributor'
            });
        } catch (error) {
            console.error(`  ✗ Failed: ${error.message}`);
            results.push({
                subscription: info.subscriptionName,
                resourceGroup: info.resourceGroup,
                status: 'failed',
                error: error.message
            });
        }
    }

    return results;
}

async function main() {
    console.log('=== Configuring RBAC for App Services Management ===');
    console.log(`Principal ID: ${PRINCIPAL_ID}`);

    try {
        const credential = await getCredential();

        // Step 1: Grant Reader on all subscriptions
        const readerResults = await grantReaderOnAllSubscriptions(credential);

        // Step 2: Grant Website Contributor on resource groups with App Services
        const contributorResults = await grantWebsiteContributorOnResourceGroups(credential);

        // Summary
        console.log('\n=== Summary ===');
        console.log(`\nReader role assignments: ${readerResults.length}`);
        console.log(`  Success: ${readerResults.filter(r => r.status === 'success').length}`);
        console.log(`  Failed: ${readerResults.filter(r => r.status === 'failed').length}`);

        console.log(`\nWebsite Contributor role assignments: ${contributorResults.length}`);
        console.log(`  Success: ${contributorResults.filter(r => r.status === 'success').length}`);
        console.log(`  Failed: ${contributorResults.filter(r => r.status === 'failed').length}`);

        const allFailed = [...readerResults, ...contributorResults].filter(r => r.status === 'failed');
        if (allFailed.length > 0) {
            console.log('\nFailed assignments:');
            allFailed.forEach(r => {
                console.log(`  - ${r.subscription}${r.resourceGroup ? '/' + r.resourceGroup : ''}: ${r.error}`);
            });
        }

        console.log('\n✓ RBAC configuration complete!');
    } catch (error) {
        console.error('\n✗ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
