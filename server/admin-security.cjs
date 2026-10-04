const { createHmac, timingSafeEqual } = require("node:crypto");

const SESSION_COOKIE = "felice_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sendJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

function requestBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString("utf8"));
    } catch {
      return {};
    }
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === String(host).split(",")[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

function sign(expiration, secret) {
  return createHmac("sha256", secret)
    .update(`${expiration}:felice-admin`)
    .digest("hex");
}

function setAdminSessionCookie(req, res) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const expiration = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = `${expiration}.${sign(expiration, secret)}`;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = process.env.VERCEL === "1" || forwardedProto === "https" || process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`,
  );
}

function clearAdminSessionCookie(req, res) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = process.env.VERCEL === "1" || forwardedProto === "https" || process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`,
  );
}

function hasAdminSession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const cookieHeader = String(req.headers.cookie || "");
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return false;

  const token = cookie.slice(SESSION_COOKIE.length + 1);
  const separator = token.indexOf(".");
  if (separator < 1) return false;
  const expiration = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiration) || Number(expiration) <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = Buffer.from(sign(expiration, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function supabaseConfig() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return null;
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return null;
  return {
    baseUrl,
    serviceKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "felice-assets",
  };
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(12000),
  });
  return response;
}

async function readLogoUrl(config) {
  const query = new URLSearchParams({
    key: "eq.site_logo_url",
    select: "value",
    limit: "1",
  });
  const response = await supabaseRequest(config, `/rest/v1/app_settings?${query}`);
  if (!response.ok) throw new Error(`Settings lookup failed with ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && typeof rows[0]?.value === "string" ? rows[0].value : null;
}

module.exports = {
  hasAdminSession,
  clearAdminSessionCookie,
  isSameOrigin,
  readLogoUrl,
  requestBody,
  sendJson,
  setAdminSessionCookie,
  supabaseRequest,
  supabaseConfig,
};