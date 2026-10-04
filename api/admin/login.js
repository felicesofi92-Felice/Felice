const {
  isSameOrigin,
  requestBody,
  sendJson,
  setAdminSessionCookie,
} = require("../../server/admin-security.cjs");
const { timingSafeEqual } = require("node:crypto");

function safePasswordMatch(provided, expected) {
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

  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!expectedPassword || !sessionSecret) {
    return sendJson(res, 503, { error: "Admin sign-in is not configured" });
  }

  const password = requestBody(req).password;
  if (typeof password !== "string" || password.length > 1024 || !safePasswordMatch(password, expectedPassword)) {
    return sendJson(res, 401, { error: "პაროლი არასწორია." });
  }

  try {
    setAdminSessionCookie(req, res);
    return sendJson(res, 200, { authenticated: true });
  } catch {
    return sendJson(res, 503, { error: "Admin sign-in is not configured" });
  }
};