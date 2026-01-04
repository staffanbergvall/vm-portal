// API client for VM Portal

export interface VMInfo {
  name: string;
  id: string;
  location: string;
  vmSize: string;
  powerState: string;
  osType: string;
  provisioningState: string;
}

export interface ListVMsResponse {
  vms: VMInfo[];
  count: number;
  resourceGroup: string;
  subscriptionId: string;
}

export interface VMActionResponse {
  success: boolean;
  message: string;
  vmName: string;
  resourceGroup?: string;
  error?: string;
}

export interface BatchVMResult {
  vmName: string;
  success: boolean;
  message: string;
}

export interface BatchVMResponse {
  success: boolean;
  message: string;
  results: BatchVMResult[];
  resourceGroup?: string;
  error?: string;
}

export interface UserInfo {
  userDetails?: string;
  userId?: string;
  identityProvider?: string;
  userRoles?: string[];
  claims?: Array<{ typ: string; val: string }>;
}

// Use relative URLs for Managed Functions API (deployed with SWA)
const API_BASE_URL = '/api';

let cachedClientPrincipal: string | null = null;

async function getClientPrincipalHeader(): Promise<string | null> {
  if (cachedClientPrincipal) return cachedClientPrincipal;

  try {
    const response = await fetch('/.auth/me');
    if (!response.ok) return null;

    const data = await response.json();
    if (data.clientPrincipal) {
      // Base64 encode the clientPrincipal to match SWA format
      cachedClientPrincipal = btoa(JSON.stringify(data.clientPrincipal));
      return cachedClientPrincipal;
    }
  } catch {
    return null;
  }
  return null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP error ${response.status}`);
  }
  return response.json();
}

/**
 * Get current user info from SWA auth endpoint
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
  try {
    const response = await fetch('/.auth/me');
    if (!response.ok) return null;

    const data = await response.json();
    return data.clientPrincipal;
  } catch {
    return null;
  }
}

/**
 * List all VMs in the target resource group
 */
export async function listVMs(): Promise<ListVMsResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms`, { headers });
  return handleResponse<ListVMsResponse>(response);
}

/**
 * Start a specific VM
 */
export async function startVM(vmName: string): Promise<VMActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms/${encodeURIComponent(vmName)}/start`, {
    method: 'POST',
    headers
  });
  return handleResponse<VMActionResponse>(response);
}

/**
 * Stop and deallocate a specific VM
 */
export async function stopVM(vmName: string): Promise<VMActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms/${encodeURIComponent(vmName)}/stop`, {
    method: 'POST',
    headers
  });
  return handleResponse<VMActionResponse>(response);
}

/**
 * Restart a specific VM
 */
export async function restartVM(vmName: string): Promise<VMActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms/${encodeURIComponent(vmName)}/restart`, {
    method: 'POST',
    headers
  });
  return handleResponse<VMActionResponse>(response);
}

/**
 * Batch start multiple VMs in parallel
 */
export async function batchStartVMs(vmNames: string[]): Promise<BatchVMResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms/batch/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ vmNames })
  });
  return handleResponse<BatchVMResponse>(response);
}

/**
 * Batch stop multiple VMs in parallel
 */
export async function batchStopVMs(vmNames: string[]): Promise<BatchVMResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms/batch/stop`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ vmNames })
  });
  return handleResponse<BatchVMResponse>(response);
}

/**
 * Logout from SWA
 */
export function logout(): void {
  window.location.href = '/.auth/logout';
}

// Schedule types
export interface ScheduleInfo {
  name: string;
  description: string | null;
  isEnabled: boolean;
  frequency: string;
  interval: number | null;
  startTime: string | null;
  nextRun: string | null;
  timeZone: string | null;
  weekDays: string[] | null;
}

export interface ListSchedulesResponse {
  schedules: ScheduleInfo[];
  count: number;
  automationAccount: string;
}

export interface UpdateScheduleResponse {
  success: boolean;
  message: string;
  schedule: {
    name: string;
    isEnabled: boolean;
    nextRun: string | null;
  };
}

export interface TriggerRunbookResponse {
  success: boolean;
  message: string;
  jobId: string;
  status: string;
}

/**
 * List all schedules from Azure Automation
 */
export async function listSchedules(): Promise<ListSchedulesResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/schedules`, { headers });
  return handleResponse<ListSchedulesResponse>(response);
}

/**
 * Update a schedule (enable/disable, change time, or change days)
 */
export async function updateSchedule(
  scheduleName: string,
  options: {
    isEnabled?: boolean;
    startTime?: string; // HH:mm format
    weekDays?: string[];
  }
): Promise<UpdateScheduleResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/schedules/${encodeURIComponent(scheduleName)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(options)
  });
  return handleResponse<UpdateScheduleResponse>(response);
}

/**
 * Manually trigger a runbook
 */
export async function triggerRunbook(runbookName: string, vmNames?: string): Promise<TriggerRunbookResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/runbooks/${encodeURIComponent(runbookName)}/run`, {
    method: 'POST',
    headers,
    body: vmNames ? JSON.stringify({ vmNames }) : undefined
  });
  return handleResponse<TriggerRunbookResponse>(response);
}

// Monitoring types
export interface MetricDataPoint {
  timestamp: string;
  average: number | null;
  maximum: number | null;
  minimum: number | null;
}

export interface VMMetrics {
  vmName: string;
  cpuPercent: MetricDataPoint[];
  networkIn: MetricDataPoint[];
  networkOut: MetricDataPoint[];
  diskReadBytes: MetricDataPoint[];
  diskWriteBytes: MetricDataPoint[];
}

export interface VMMetricsResponse {
  metrics: VMMetrics;
  timespan: string;
  interval: string;
}

export interface VMSummary {
  name: string;
  powerState: string;
  cpuPercent: number | null;
  networkInMB: number | null;
  networkOutMB: number | null;
}

export interface VMsSummaryResponse {
  vms: VMSummary[];
  totalRunning: number;
  totalStopped: number;
  avgCpu: number | null;
  timestamp: string;
}

export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  vmName: string | null;
  user: string | null;
  status: string;
  message: string | null;
  duration: number | null;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  count: number;
  hours: number;
  limit: number;
}

/**
 * Get metrics for a specific VM
 */
export async function getVMMetrics(vmName: string, timespan: string = 'PT1H'): Promise<VMMetricsResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms/${encodeURIComponent(vmName)}/metrics?timespan=${timespan}`, { headers });
  return handleResponse<VMMetricsResponse>(response);
}

/**
 * Get summary metrics for all VMs
 */
export async function getVMsSummary(): Promise<VMsSummaryResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/vms/summary`, { headers });
  return handleResponse<VMsSummaryResponse>(response);
}

/**
 * Get audit log entries
 */
export async function getAuditLog(hours: number = 24, limit: number = 100): Promise<AuditLogResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/audit-log?hours=${hours}&limit=${limit}`, { headers });
  return handleResponse<AuditLogResponse>(response);
}

// App Services types
export interface AppServiceInfo {
  name: string;
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  resourceGroup: string;
  location: string;
  state: string;
  sku: string | null;
  kind: string | null;
}

export interface ListAppServicesResponse {
  appServicesByResourceGroup: Record<string, AppServiceInfo[]>;
  totalCount: number;
  subscriptionsScanned: string[];
  failedSubscriptions?: Array<{ id: string; error: string }>;
}

export interface AppServiceActionResponse {
  success: boolean;
  message: string;
  appServiceName: string;
}

export interface ScaleAppServiceRequest {
  subscriptionId: string;
  resourceGroup: string;
  sku: {
    name: string;
    tier: string;
    capacity?: number;
  };
}

export interface ConfigureAppServiceRequest {
  subscriptionId: string;
  resourceGroup: string;
  appSettings: Record<string, string>;
}

/**
 * List all App Services from all subscriptions
 */
export async function listAppServices(): Promise<ListAppServicesResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {};
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(`${API_BASE_URL}/appservices`, { headers });
  return handleResponse<ListAppServicesResponse>(response);
}

/**
 * Start an App Service
 */
export async function startAppService(
  appServiceName: string,
  subscriptionId: string,
  resourceGroup: string
): Promise<AppServiceActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(
    `${API_BASE_URL}/appservices/${encodeURIComponent(appServiceName)}/start`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscriptionId, resourceGroup })
    }
  );
  return handleResponse<AppServiceActionResponse>(response);
}

/**
 * Stop an App Service
 */
export async function stopAppService(
  appServiceName: string,
  subscriptionId: string,
  resourceGroup: string
): Promise<AppServiceActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(
    `${API_BASE_URL}/appservices/${encodeURIComponent(appServiceName)}/stop`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscriptionId, resourceGroup })
    }
  );
  return handleResponse<AppServiceActionResponse>(response);
}

/**
 * Restart an App Service
 */
export async function restartAppService(
  appServiceName: string,
  subscriptionId: string,
  resourceGroup: string
): Promise<AppServiceActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(
    `${API_BASE_URL}/appservices/${encodeURIComponent(appServiceName)}/restart`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscriptionId, resourceGroup })
    }
  );
  return handleResponse<AppServiceActionResponse>(response);
}

/**
 * Scale an App Service (change SKU/capacity)
 */
export async function scaleAppService(
  appServiceName: string,
  request: ScaleAppServiceRequest
): Promise<AppServiceActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(
    `${API_BASE_URL}/appservices/${encodeURIComponent(appServiceName)}/scale`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(request)
    }
  );
  return handleResponse<AppServiceActionResponse>(response);
}

/**
 * Configure App Service (update app settings)
 */
export async function configureAppService(
  appServiceName: string,
  request: ConfigureAppServiceRequest
): Promise<AppServiceActionResponse> {
  const clientPrincipal = await getClientPrincipalHeader();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (clientPrincipal) {
    headers['x-ms-client-principal'] = clientPrincipal;
  }

  const response = await fetch(
    `${API_BASE_URL}/appservices/${encodeURIComponent(appServiceName)}/configure`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(request)
    }
  );
  return handleResponse<AppServiceActionResponse>(response);
}
