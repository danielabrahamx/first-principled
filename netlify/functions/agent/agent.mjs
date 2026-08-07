export default async (req) => {
  const body = await req.json().catch(() => ({}));
  return Response.json({
    ok: true,
    stub: "implemented in ticket 06",
    received: Object.keys(body),
  });
};
