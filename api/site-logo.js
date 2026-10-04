const { readLogoUrl, sendJson, supabaseConfig } = require("../server/admin-security.cjs");

module.exports = async function getSiteLogo(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const config = supabaseConfig();
  if (!config) return sendJson(res, 200, { logoUrl: null });

  try {
    return sendJson(res, 200, { logoUrl: await readLogoUrl(config) });
  } catch (error) {
    console.error("Could not read the site logo setting:", error.message);
    return sendJson(res, 502, { error: "Logo settings could not be loaded" });
  }
};