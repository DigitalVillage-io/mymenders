import { handleAdminRequest } from './lib/admin.js';

const getAdminPath = (request: Request) => {
  const url = new URL(request.url);
  return (url.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
};

export const GET = (request: Request) => handleAdminRequest(request, getAdminPath(request));
export const POST = (request: Request) => handleAdminRequest(request, getAdminPath(request));
export const PATCH = (request: Request) => handleAdminRequest(request, getAdminPath(request));
export const DELETE = (request: Request) => handleAdminRequest(request, getAdminPath(request));
