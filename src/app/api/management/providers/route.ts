import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  DELETE as deleteProvider,
  GET as getProviders,
  PATCH as updateProvider,
  POST as createProvider,
} from "../../providers/route";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return getProviders(request);
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return createProvider(request);
}

export async function PATCH(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return updateProvider(request);
}

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return deleteProvider(request);
}
