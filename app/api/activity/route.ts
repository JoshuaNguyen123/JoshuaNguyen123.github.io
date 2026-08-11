import { getActivityDashboard } from "@/lib/activity/service.ts";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end || !isoDate.test(start) || !isoDate.test(end)) {
    return Response.json(
      { error: "A valid start and end date are required" },
      { status: 400 },
    );
  }

  try {
    const payload = await getActivityDashboard(start, end);
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch {
    return Response.json({ error: "Invalid activity range" }, { status: 400 });
  }
}
