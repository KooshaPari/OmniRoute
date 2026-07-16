import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { GET as getBudget, POST as topUpBudget } from "../../../compression/budget/route";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return getBudget(request);
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return topUpBudget(request);
}
