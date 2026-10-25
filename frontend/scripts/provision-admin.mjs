/**
 * Create (or promote) the UstozDaftar administrator account and verify it.
 *
 *   cd frontend
 *   node --env-file=.env.local scripts/provision-admin.mjs admin@example.com
 *
 * What it does
 *   1. Generates a strong temporary password on this machine (never printed:
 *      it is written to a 0600 file outside the repository).
 *   2. Creates the Firebase Auth user with the server-side custom claim
 *      { admin: true } — the only thing /api/admin/* and firestore.rules trust.
 *      An existing user with that email is promoted instead; its password is
 *      left unchanged unless --reset-password is given.
 *   3. Signs in once with the email/password through Firebase Auth and checks
 *      that the issued ID token really carries admin: true.
 *
 * Credentials it uses (nothing is stored in the repository)
 *   - FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS, if set: Admin SDK.
 *   - otherwise your Firebase CLI login (`firebase login`): `firebase auth:import`
 *     with a STANDARD_SCRYPT hash of the temporary password.
 *   - NEXT_PUBLIC_FIREBASE_API_KEY / NEXT_PUBLIC_FIREBASE_PROJECT_ID for the
 *     verification sign-in (public values).
 * With FIREBASE_AUTH_EMULATOR_HOST set, everything runs against the emulator.
 */
import { execFileSync } from "node:child_process";
import { randomBytes, randomInt, scryptSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const resetPassword = args.includes("--reset-password");
const outFile = (args.find((a) => a.startsWith("--out=")) || "").slice(6) || path.join(homedir(), "ustozdaftar-admin-credentials.txt");
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;

function die(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die("Usage: node --env-file=.env.local scripts/provision-admin.mjs <admin-email> [--reset-password] [--out=<file>]");
if (!projectId) die("FIREBASE_PROJECT_ID / NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.");
// Never switch targets silently: the emulator must be asked for explicitly,
// and the two project-id variables must agree.
if (emulator && !args.includes("--emulator")) {
  die(`FIREBASE_AUTH_EMULATOR_HOST is set (${emulator}). Unset it to provision the real project, or pass --emulator.`);
}
if (!emulator && args.includes("--emulator")) die("--emulator given but FIREBASE_AUTH_EMULATOR_HOST is not set.");
const publicProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (process.env.FIREBASE_PROJECT_ID && publicProject && process.env.FIREBASE_PROJECT_ID !== publicProject) {
  die(`FIREBASE_PROJECT_ID (${process.env.FIREBASE_PROJECT_ID}) and NEXT_PUBLIC_FIREBASE_PROJECT_ID (${publicProject}) differ.`);
}
if (!apiKey && !emulator) die("NEXT_PUBLIC_FIREBASE_API_KEY is not set (needed to verify the sign-in).");

/** 20 characters, guaranteed upper/lower/digit/symbol, from crypto randomness. */
function generatePassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*-_=+?"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 20) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const identityBase = emulator ? `http://${emulator}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";

async function signIn(password) {
  const res = await fetch(`${identityBase}/v1/accounts:signInWithPassword?key=${apiKey || "emulator"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const claims = JSON.parse(Buffer.from(body.idToken.split(".")[1], "base64url").toString("utf8"));
  return { uid: body.localId, admin: claims.admin === true };
}

async function withAdminSdk(password) {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const options = { projectId };
  if (process.env.FIREBASE_SERVICE_ACCOUNT) options.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  const auth = getAuth(initializeApp(options));
  let user = await auth.getUserByEmail(email).catch(() => null);
  let created = false;
  if (!user) {
    user = await auth.createUser({ email, password, displayName: "UstozDaftar Admin", emailVerified: false });
    created = true;
  } else if (resetPassword) {
    await auth.updateUser(user.uid, { password });
  }
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  return { uid: user.uid, created, passwordSet: created || resetPassword };
}

function withFirebaseCli(password) {
  // STANDARD_SCRYPT import: the CLI login creates the user with the claim in one step.
  const N = 16384, r = 8, p = 1, dkLen = 64;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, dkLen, { N, r, p, maxmem: 64 * 1024 * 1024 });
  const dir = mkdtempSync(path.join(tmpdir(), "ud-admin-"));
  const file = path.join(dir, "admin-user.json");
  const uid = `admin-${randomBytes(6).toString("hex")}`;
  try {
    writeFileSync(
      file,
      JSON.stringify({
        users: [
          {
            localId: uid,
            email,
            emailVerified: false,
            displayName: "UstozDaftar Admin",
            passwordHash: hash.toString("base64"),
            salt: salt.toString("base64"),
            customAttributes: JSON.stringify({ admin: true }),
          },
        ],
      }),
      { mode: 0o600 }
    );
    execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["-y", "firebase-tools@latest", "auth:import", file, "--project", projectId, "--hash-algo=STANDARD_SCRYPT",
        `--memory-cost=${N}`, `--block-size=${r}`, `--parallelization=${p}`, `--dk-len=${dkLen}`],
      { stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true }); // the hash file never outlives the import
  }
  return { uid, created: true, passwordSet: true };
}

const password = generatePassword();
const useAdminSdk = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS || emulator);
console.log(`→ ${emulator ? "emulator" : `project ${projectId}`}: provisioning ${email} via ${useAdminSdk ? "Admin SDK" : "Firebase CLI (auth:import)"}`);

let result;
try {
  result = useAdminSdk ? await withAdminSdk(password) : withFirebaseCli(password);
} catch (error) {
  die(`Could not create the account: ${error?.message || error}. (An existing email cannot be re-imported via the CLI — set FIREBASE_SERVICE_ACCOUNT to promote it.)`);
}

if (result.passwordSet) {
  writeFileSync(
    outFile,
    [
      "UstozDaftar.uz administrator — TEMPORARY credentials",
      `Login URL : ${(process.env.APP_BASE_URL || "https://<your-domain>").replace(/\/+$/, "")}/login  → then /dashboard/admin`,
      `Email     : ${email}`,
      `Password  : ${password}`,
      "",
      "Change it now: Sozlamalar (Settings) → Parol → current temporary password + new password.",
      "Then delete this file.",
      "",
    ].join("\n"),
    { mode: 0o600 }
  );
}

try {
  if (!result.passwordSet) {
    console.log(`✔ Existing user ${result.uid} now has the admin claim (password unchanged; use --reset-password for a new temporary one).`);
    console.log("  The user must sign out and in again (or wait up to 1 hour) for the claim to reach the browser.");
    process.exit(0);
  }
  const check = await signIn(password);
  if (!check.admin) die(`Signed in as ${check.uid}, but the token has no admin claim.`);
  console.log(`✔ Verified: ${email} (uid ${check.uid}) can sign in and its ID token carries admin: true.`);
  console.log(`✔ Temporary password written to ${outFile} (not printed). Change it after the first login, then delete the file.`);
} catch (error) {
  die(`Account provisioned but the verification sign-in failed: ${error.message}`);
}
