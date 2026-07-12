import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

type ManagementEvent = {
  type: "snapshot" | "heartbeat";
  timestamp: string;
  data: Record<string, unknown>;
};

function encodeEvent(event: ManagementEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ManagementEvent) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      send({
        type: "snapshot",
        timestamp: new Date().toISOString(),
        data: {
          service: "omniroute-management-events",
          transports: ["sse-heartbeat"],
          status: "heartbeat-only",
        },
      });

      interval = setInterval(() => {
        send({
          type: "heartbeat",
          timestamp: new Date().toISOString(),
          data: { status: "alive" },
        });
      }, 15_000);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
