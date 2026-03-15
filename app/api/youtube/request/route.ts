import { auth } from "@/auth";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

type ProxyRequest = {
  apiName: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as ProxyRequest;

  const query = new URLSearchParams();
  Object.entries(payload.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      query.append(key, String(value));
    }
  });

  const url = `${BASE_URL}/${payload.apiName}${query.size ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: payload.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    },
    body: payload.body ? JSON.stringify(payload.body) : undefined,
    cache: "no-store"
  });

  const text = await response.text();
  let json: unknown;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  const reason =
    (json as { error?: { errors?: Array<{ reason?: string }> } })?.error?.errors?.[0]
      ?.reason ?? null;

  return Response.json({
    ok: response.ok,
    status: response.status,
    apiName: payload.apiName,
    method: payload.method ?? "GET",
    reason,
    data: json
  });
}
