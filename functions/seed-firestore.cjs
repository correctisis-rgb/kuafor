const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({
  credential: applicationDefault(),
  projectId: "kuafor-a1e07",
});

const db = getFirestore();

async function main() {
  const batch = db.batch();

  batch.set(db.doc("settings/business"), {
    openTime: "09:00",
    closeTime: "18:00",
    breakStart: "12:30",
    breakEnd: "13:30",
    slotMinutes: 30,
    daysOff: [0],
    timeZone: "Europe/Istanbul",
  }, { merge: true });

  const services = [
    ["sac-kesimi", { name: "Saç kesimi", durationMinutes: 30, price: 300, active: true }],
    ["sakal", { name: "Sakal tıraşı", durationMinutes: 30, price: 150, active: true }],
    ["sac-sakal", { name: "Saç + sakal", durationMinutes: 60, price: 400, active: true }],
  ];

  for (const [id, data] of services) {
    batch.set(db.doc("services/" + id), data, { merge: true });
  }

  await batch.commit();
  console.log("Firestore başlangıç ayarları ve 3 hizmet kaydedildi.");
}

main().catch(error => {
  console.error("Firestore başlangıç verileri kaydedilemedi:", error.message);
  process.exitCode = 1;
});
