// Regression test: logging in must not change the shared (service-role) Supabase client.
const Module = require("module"); const path = require("path"); const http = require("http");
const B = path.join(__dirname, "..") + "/";
let pass = 0, fail = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); c ? pass++ : fail++; };

let sharedSignIns = 0, authSignIns = 0;
const authClient = { auth: { signInWithPassword: async () => { authSignIns++; return { data: { session: { access_token: "t", refresh_token: "r" }, user: { id: "u1" } }, error: null }; } } };
const shared = {
  auth: { signInWithPassword: async () => { sharedSignIns++; return { data: null, error: { message: "should not be used" } }; } },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { full_name: "Test" } }) }) }) }),
  createAuthClient: () => authClient,
};
const orig = Module._load;
Module._load = function (r) { return /supabaseClient$/.test(r) ? shared : orig.apply(this, arguments); };

const express = require(B + "node_modules/express");
const app = express(); app.use(express.json()); app.use("/api/auth", require(B + "routes/auth.js"));
const srv = app.listen(0, async () => {
  const port = srv.address().port;
  const body = JSON.stringify({ email: "a@b.co", password: "password1" });
  const res = await new Promise(r => { const q = http.request({ port, path: "/api/auth/login", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, s => { let d = ""; s.on("data", c => d += c); s.on("end", () => r({ status: s.statusCode, json: JSON.parse(d) })); }); q.end(body); });
  ok("login succeeds and returns a token", res.status === 200 && res.json.token === "t");
  ok("sign-in used the throw-away auth client", authSignIns === 1);
  ok("shared service-role client was NOT used to sign in", sharedSignIns === 0);
  console.log(`\n${pass} passed, ${fail} failed`); srv.close(); process.exit(fail ? 1 : 0);
});
