import { bffUnconfiguredResponse } from '$lib/server/bff-unconfigured';
import type { RequestHandler } from './$types';

const unavailable: RequestHandler = () => bffUnconfiguredResponse();

export const GET = unavailable;
export const POST = unavailable;
