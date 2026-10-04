const {
  isSameOrigin,
  requestBody,
  sendJson,
  setAdminSessionCookie,
} = require("../../server/admin-security.cjs");
const { timingSafeEqual } = require("node:crypto");

function safeStringMatch(provided, expected) {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

module.exports = function login(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (!isSameOrigin(req)) return sendJson(res, 403, { error: "Request origin rejected" });

  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!expectedEmail || !expectedPassword || !sessionSecret) {
    return sendJson(res, 503, { error: "Admin sign-in is not configured" });
  }

  const body = requestBody(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const validEmail = email.length <= 254 && safeStringMatch(email, expectedEmail);
  const validPassword = password.length <= 1024 && safeStringMatch(password, expectedPassword);
  if (!validEmail || !validPassword) {
    return sendJson(res, 401, { error: "ელფოსტა ან პაროლი არასწორია." });
  }

  try {
    setAdminSessionCookie(req, res);
    return sendJson(res, 200, { authenticated: true });
  } catch {
    return sendJson(res, 503, { error: "Admin sign-in is not configured" });
  }
};