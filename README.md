# VM Portal

En webbportal för att hantera (starta/stoppa) virtuella maskiner i Azure.

## Arkitektur

- **Frontend**: React SPA med Vite
- **Backend**: Azure Functions (Node.js/TypeScript)
- **Hosting**: Azure Static Web Apps (Standard)
- **Autentisering**: Microsoft Entra ID med App Roles

## Förutsättningar

1. Azure-prenumeration
2. Entra ID-tenant med behörighet att skapa App Registrations
3. Node.js 20+
4. Azure CLI

## Lokal utveckling

### API

```bash
cd api
npm install
npm start
```

API:et körs på http://localhost:7071

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend körs på http://localhost:5173 (proxar till API:et)

## Deployment

### 1. Deploya infrastruktur

```bash
cd infrastructure
az deployment group create \
  --resource-group rg-vmportal \
  --template-file main.bicep \
  --parameters main.bicepparam
```

### 2. Konfigurera RBAC

```bash
# Hämta Function App Principal ID från deployment output
PRINCIPAL_ID=$(az deployment group show -g rg-vmportal -n main --query properties.outputs.functionAppPrincipalId.value -o tsv)

# Deploya RBAC till VM-resursgruppen
az deployment group create \
  --resource-group rg-migrate-hyperv \
  --template-file rbac.bicep \
  --parameters functionAppPrincipalId=$PRINCIPAL_ID vmResourceGroup=rg-migrate-hyperv
```

### 3. Konfigurera Entra ID

1. Skapa App Registration i Azure Portal
2. Konfigurera Redirect URI: `https://<swa-url>/.auth/login/aad/callback`
3. Skapa Client Secret
4. Skapa App Role: `vm-admin`
5. Tilldela användare/grupper till rollen

### 4. Konfigurera SWA

1. Lägg till Application Settings:
   - `ENTRA_CLIENT_ID`: Din App Registration Client ID
   - `ENTRA_CLIENT_SECRET`: Din Client Secret

2. Uppdatera `staticwebapp.config.json` med din Tenant ID

### 5. DNS-konfiguration

Hos din DNS-leverantör:

```
vm.moderncloud.se  CNAME  <swa-hostname>.azurestaticapps.net
_dnsauth.vm.moderncloud.se  TXT  <validation-token>
```

## API-endpoints

| Endpoint | Metod | Beskrivning |
|----------|-------|-------------|
| `/api/GetRoles` | POST | Returnerar användarroller (kallas av SWA) |
| `/api/vms` | GET | Lista alla VMs med status |
| `/api/vms/{name}/start` | POST | Starta en VM |
| `/api/vms/{name}/stop` | POST | Stoppa och frigör en VM |

## Säkerhet

- All åtkomst kräver Entra ID-autentisering
- Endast användare med `vm-admin`-rollen har åtkomst
- Function App använder Managed Identity med minimal RBAC
- Alla VM-operationer loggas till Application Insights
