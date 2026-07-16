import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { decodeManagementRpcFrame } from "@/server/management/rpc/protocol";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    decodeManagementRpcFrame(await request.text());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid management RPC frame" },
      { status: 400 },
    );
  }

  return Response.json(
    {
      error: "Management RPC dispatch is not enabled for loopback HTTP",
      transport: "local-daemon-required",
    },
    { status: 501 },
  );
}
