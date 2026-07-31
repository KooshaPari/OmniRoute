import { bffUnconfiguredResponse } from '$lib/server/bff-unconfigured';
import type { RequestHandler } from './$types';

const unavailable: RequestHandler = () => bffUnconfiguredResponse();

export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
