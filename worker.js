export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json(
        { ok: true, service: "squeekstage", runtime: "cloudflare-workers" },
        { headers: { "cache-control": "no-store" } },
      );
    }

    return env.ASSETS.fetch(request);
  },
};
