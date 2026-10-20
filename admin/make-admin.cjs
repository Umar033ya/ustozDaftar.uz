const fs = require("node:fs");
const path = require("node:path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const uid = process.argv[2];

  if (!keyPath || !uid) {
    throw new Error(
      "Foydalanish: GOOGLE_APPLICATION_CREDENTIALS o‘rnatilsin va UID berilsin."
    );
  }

  const credentials = JSON.parse(
    fs.readFileSync(path.resolve(keyPath), "utf8")
  );

  initializeApp({ credential: cert(credentials) });
  await getAuth().setCustomUserClaims(uid, { admin: true });

  console.log("Admin huquqi muvaffaqiyatli berildi.");
}

main().catch((error) => {
  console.error("Xatolik:", error.message);
  process.exitCode = 1;
});
