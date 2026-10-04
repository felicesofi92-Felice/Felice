const { clearAdminSessionCookie, isSameOrigin, sendJson } = require("../../server/admin-security.cjs");

module.exports = function logout(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (!isSameOrigin(req)) return sendJson(res, 403, { error: "Request origin rejected" });
  clearAdminSessionCookie(req, res);
  return sendJson(res, 200, { authenticated: false });
};