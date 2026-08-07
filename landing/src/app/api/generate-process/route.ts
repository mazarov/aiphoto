import { NextResponse } from "next/server";

/**
 * Image generation is handled exclusively by web-generation-worker.
 * Keep this tombstone temporarily so stale clients cannot trigger duplicate
 * processing through the former public endpoint.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "generation_worker_required",
      message: "Generation processing moved to the durable worker queue",
    },
    { status: 410 }
  );
}
