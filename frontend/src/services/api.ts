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

export interface UserInfo {
  userDetails?: string;
  userId?: string;
  identityProvider?: string;
  userRoles?: string[];
  claims?: Array<{ typ: string; val: string }>;
}

const API_BASE = '/api';

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
  const response = await fetch(`${API_BASE}/vms`);
  return handleResponse<ListVMsResponse>(response);
}

/**
 * Start a specific VM
 */
export async function startVM(vmName: string): Promise<VMActionResponse> {
  const response = await fetch(`${API_BASE}/vms/${encodeURIComponent(vmName)}/start`, {
    method: 'POST'
  });
  return handleResponse<VMActionResponse>(response);
}

/**
 * Stop and deallocate a specific VM
 */
export async function stopVM(vmName: string): Promise<VMActionResponse> {
  const response = await fetch(`${API_BASE}/vms/${encodeURIComponent(vmName)}/stop`, {
    method: 'POST'
  });
  return handleResponse<VMActionResponse>(response);
}

/**
 * Logout from SWA
 */
export function logout(): void {
  window.location.href = '/.auth/logout';
}
