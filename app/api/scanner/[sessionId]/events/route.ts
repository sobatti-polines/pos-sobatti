import { addListener, ensureSession } from "@/lib/scanner-relay";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  ensureSession(sessionId);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      // SSE handshake
      controller.enqueue(enc.encode(": connected\n\n"));

      // Keep-alive ping every 20s
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 20_000);

      // Subscribe to relay
      const remove = addListener(sessionId, (barcode: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ barcode })}\n\n`));
        } catch {
          /* client gone */
        }
      });

      // Cleanup when client disconnects
      return () => {
        clearInterval(ping);
        remove();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
