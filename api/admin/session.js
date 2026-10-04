const { hasAdminSession, sendJson } = require("../../server/admin-security.cjs");

module.exports = function session(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  return sendJson(res, 200, { authenticated: hasAdminSession(req) });
};