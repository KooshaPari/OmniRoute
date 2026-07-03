import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { GET as getModels, PUT as updateModelAlias } from "../../models/route";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return getModels(request);
}

export async function PUT(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return updateModelAlias(request);
}
