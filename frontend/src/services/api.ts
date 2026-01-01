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

// Use direct Function App URL since linked backend doesn't work
const FUNCTION_APP_URL = 'https://func-vmportalprod-fg3mvon3.azurewebsites.net';

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

  const response = await fetch(`${FUNCTION_APP_URL}/api/vms`, { headers });
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

  const response = await fetch(`${FUNCTION_APP_URL}/api/vms/${encodeURIComponent(vmName)}/start`, {
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

  const response = await fetch(`${FUNCTION_APP_URL}/api/vms/${encodeURIComponent(vmName)}/stop`, {
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

  const response = await fetch(`${FUNCTION_APP_URL}/api/vms/${encodeURIComponent(vmName)}/restart`, {
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

  const response = await fetch(`${FUNCTION_APP_URL}/api/vms/batch/start`, {
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

  const response = await fetch(`${FUNCTION_APP_URL}/api/vms/batch/stop`, {
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
