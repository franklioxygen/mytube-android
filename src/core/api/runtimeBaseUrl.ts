import { API_BASE_URL } from '../utils/env';

let runtimeApiBaseUrl = API_BASE_URL;

export function getRuntimeApiBaseUrl(): string {
  return runtimeApiBaseUrl;
}

export function setRuntimeApiBaseUrl(url: string): void {
  runtimeApiBaseUrl = url;
}

export function getRuntimeHostBase(): string {
  return runtimeApiBaseUrl.replace(/\/api\/?$/, '') || 'http://10.0.2.2:5551';
}
