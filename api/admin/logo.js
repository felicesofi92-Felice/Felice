const {
  hasAdminSession,
  isSameOrigin,
  requestBody,
  sendJson,
  supabaseConfig,
  supabaseRequest,
} = require("../../server/admin-security.cjs");

const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const BUCKET_PATH = "branding/felice-logo";

function validImageSignature(bytes, mimeType) {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

module.exports = async function uploadLogo(req, res) {
  if (!hasAdminSession(req)) return sendJson(res, 401, { error: "Admin sign-in required" });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (!isSameOrigin(req)) return sendJson(res, 403, { error: "Request origin rejected" });

  const config = supabaseConfig();
  if (!config) return sendJson(res, 503, { error: "Logo storage is not configured" });

  const { mimeType, base64 } = requestBody(req);
  if (typeof mimeType !== "string" || !MIME_TYPES.has(mimeType) || typeof base64 !== "string") {
    return sendJson(res, 400, { error: "Upload a PNG, JPG, or WEBP image" });
  }
  if (base64.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return sendJson(res, 413, { error: "Logo file is too large or invalid" });
  }

  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_FILE_BYTES || !validImageSignature(bytes, mimeType)) {
    return sendJson(res, 400, { error: "The file content does not match a supported image" });
  }

  try {
    const bucket = encodeURIComponent(config.bucket);
    const objectPath = BUCKET_PATH.split("/").map(encodeURIComponent).join("/");
    const upload = await supabaseRequest(config, `/storage/v1/object/${bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=60",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!upload.ok) {
      const providerMessage = (await upload.text()).slice(0, 300);
      console.error("Supabase logo upload failed:", upload.status, providerMessage);
      return sendJson(res, 502, { error: "Logo upload failed" });
    }

    const version = Date.now();
    const logoUrl = `${config.baseUrl}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${objectPath}?v=${version}`;
    const settingUrl = new URL("/rest/v1/app_settings", config.baseUrl);
    settingUrl.searchParams.set("on_conflict", "key");
    const saveSetting = await supabaseRequest(config, `${settingUrl.pathname}${settingUrl.search}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{
        key: "site_logo_url",
        value: logoUrl,
        updated_at: new Date().toISOString(),
      }]),
    });
    if (!saveSetting.ok) {
      const providerMessage = (await saveSetting.text()).slice(0, 300);
      console.error("Supabase logo setting save failed:", saveSetting.status, providerMessage);
      return sendJson(res, 502, { error: "Logo settings could not be saved" });
    }

    return sendJson(res, 200, { logoUrl });
  } catch (error) {
    console.error("Logo upload failed:", error.message);
    return sendJson(res, 502, { error: "Logo upload failed" });
  }
};