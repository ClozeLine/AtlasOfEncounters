const ALLOWED_ORIGINS = new Set([
  "https://clozeline.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

const ID_RE = /^[a-f0-9]{16,64}$/;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://clozeline.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname !== "/sync") {
      return json({ error: "not found" }, 404, origin);
    }

    const id = url.searchParams.get("id");
    if (!id || !ID_RE.test(id)) {
      return json({ error: "invalid id" }, 400, origin);
    }

    if (request.method === "GET") {
      const raw = await env.ATLAS_SYNC.get(id);
      if (!raw) return json({ countries: [], updatedAt: 0 }, 200, origin);
      try {
        const data = JSON.parse(raw);
        return json(data, 200, origin);
      } catch {
        return json({ countries: [], updatedAt: 0 }, 200, origin);
      }
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid json" }, 400, origin);
      }
      const countries = Array.isArray(body?.countries) ? body.countries : null;
      if (!countries) return json({ error: "missing countries" }, 400, origin);
      if (countries.length > 500) return json({ error: "too many" }, 400, origin);
      const clean = [];
      for (const c of countries) {
        if (typeof c === "string" && /^[A-Z]{2,4}$/.test(c)) clean.push(c);
      }
      const payload = { countries: [...new Set(clean)], updatedAt: Date.now() };
      await env.ATLAS_SYNC.put(id, JSON.stringify(payload));
      return json(payload, 200, origin);
    }

    return json({ error: "method not allowed" }, 405, origin);
  },
};
