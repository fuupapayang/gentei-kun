/* 限定くん runtime config (shared by customer pages / admin / tool / service worker).
 * The Pages build overwrites this file with the real apiBase.
 *   apiBase: "" => same-origin "/api" (local `npm start`)
 *            "https://.../api" => cross-origin API root (what "/api" maps to)
 *            "firebase" => no server: firebase-api.js (loaded below) answers every gApi() request from Firestore;
 *                         then GENTEI_CONFIG also carries {firebase:{apiKey,authDomain,projectId,appId}, adminEmails:[..]}
 */
(function (g) {
  var C = g.GENTEI_CONFIG = g.GENTEI_CONFIG || { apiBase: "" };
  /* site base path, derived from where this file was loaded (always the site root), e.g. "/" or "/gentei-test/" */
  var base = "/";
  try {
    var src = (g.document && g.document.currentScript && g.document.currentScript.src) || (g.location && g.location.href) || "";
    base = new URL(".", src).pathname;
  } catch (e) {}
  g.GENTEI_BASE = base;
  /* "/assets/x.png" -> BASE + "assets/x.png"; anything else (relative, http(s), data:, //host) is returned unchanged */
  g.gUrl = function (u) {
    if (typeof u !== "string" || u.charAt(0) !== "/" || u.charAt(1) === "/") return u;
    if (base !== "/" && u.indexOf(base) === 0) return u; /* already base-prefixed (idempotent) */
    return base + u.slice(1);
  };
  /* gApi("/property") -> apiBase + "/property" (or "/api/property" when apiBase is empty) */
  g.gApi = function (p) {
    if (C.apiBase === "firebase") return "https://firebase.invalid/api" + p; /* intercepted by firebase-api.js, never hits the network */
    var a = (C.apiBase || "").replace(/\/+$/, "");
    return a ? a + p : "/api" + p;
  };
  /* firebase mode: load the fetch shim synchronously (right after this script, before app.js / admin.js / tool scripts) */
  if (C.apiBase === "firebase" && g.document && g.document.readyState === "loading" && g.document.currentScript) {
    g.document.write('<script src="' + base + 'firebase-api.js"><\/script>');
  }
})(typeof self !== "undefined" ? self : this);
