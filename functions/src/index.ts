import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const REGION = "europe-west1";
const ZONE = "Europe/Istanbul";
const mins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const validClock = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
function requireUid(request: any) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Önce giriş yapın.");
  return request.auth.uid as string;
}
async function requireAdmin(uid: string) {
  const snap = await db.doc("admins/" + uid).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "Yönetici yetkisi gerekli.");
}
function makeDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validClock(time)) throw new HttpsError("invalid-argument", "Tarih veya saat geçersiz.");
  // Türkiye yerel saati UTC+03:00'dır.
  const d = new Date(date + "T" + time + ":00+03:00");
  if (!Number.isFinite(d.getTime())) throw new HttpsError("invalid-argument", "Tarih geçersiz.");
  return d;
}
export const createAppointment = onCall({ region: REGION }, async request => {
  const uid = requireUid(request);
  const { serviceId, date, time } = request.data || {};
  const customerName = String(request.data?.customerName || "").trim().slice(0, 100);
  if (!serviceId || !customerName) throw new HttpsError("invalid-argument", "Hizmet ve ad gerekli.");
  const start = makeDate(String(date), String(time));
  if (start.getTime() <= Date.now()) throw new HttpsError("failed-precondition", "Geçmiş bir saate randevu alınamaz.");
  const serviceRef = db.doc("services/" + String(serviceId));
  const settingsRef = db.doc("settings/business");
  const [serviceSnap, settingsSnap] = await Promise.all([serviceRef.get(), settingsRef.get()]);
  if (!serviceSnap.exists || !settingsSnap.exists) throw new HttpsError("failed-precondition", "Hizmet veya çalışma saatleri tanımlanmamış.");
  const service = serviceSnap.data()!;
  const settings = settingsSnap.data()!;
  if (service.active === false) throw new HttpsError("failed-precondition", "Bu hizmet şu anda sunulmuyor.");
  const duration = Number(service.durationMinutes || 30);
  if (!Number.isInteger(duration) || duration < 10 || duration > 240) throw new HttpsError("failed-precondition", "Hizmet süresi geçersiz.");
  const localDate = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const weekday = localDate.getUTCDay();
  const startMinute = mins(String(time));
  const open = String(settings.openTime || "09:00"), close = String(settings.closeTime || "18:00");
  const breakStart = String(settings.breakStart || "12:30"), breakEnd = String(settings.breakEnd || "13:30");
  if (!validClock(open) || !validClock(close) || !validClock(breakStart) || !validClock(breakEnd)) throw new HttpsError("failed-precondition", "Çalışma saatleri hatalı.");
  if ((settings.daysOff || []).includes(weekday) || startMinute < mins(open) || startMinute + duration > mins(close) ||
      (startMinute < mins(breakEnd) && startMinute + duration > mins(breakStart))) {
    throw new HttpsError("failed-precondition", "Bu saat çalışma saatleri dışında.");
  }
  const slotMinutes = 15;
  const first = Math.floor(start.getTime() / (slotMinutes * 60000));
  const last = Math.ceil((start.getTime() + duration * 60000) / (slotMinutes * 60000));
  const slotIds = Array.from({ length: last - first }, (_, i) => "s" + (first + i));
  const appointmentRef = db.collection("appointments").doc();
  await db.runTransaction(async tx => {
    const lockRefs = slotIds.map(id => db.doc("slotLocks/" + id));
    const locks = await Promise.all(lockRefs.map(ref => tx.get(ref)));
    if (locks.some(s => s.exists)) throw new HttpsError("already-exists", "Bu saat dolu. Başka saat seçin.");
    for (const ref of lockRefs) tx.create(ref, { appointmentId: appointmentRef.id, customerUid: uid, createdAt: FieldValue.serverTimestamp() });
    tx.create(appointmentRef, {
      customerUid: uid, customerName, serviceId: String(serviceId), serviceName: String(service.name || "Hizmet"),
      durationMinutes: duration, price: Number(service.price || 0), startAt: Timestamp.fromDate(start),
      endAt: Timestamp.fromDate(new Date(start.getTime() + duration * 60000)), date: String(date), time: String(time),
      slotIds, status: "booked", createdAt: FieldValue.serverTimestamp(), timeZone: ZONE
    });
  });
  return { appointmentId: appointmentRef.id };
});
export const cancelAppointment = onCall({ region: REGION }, async request => {
  const uid = requireUid(request);
  const id = String(request.data?.appointmentId || "");
  if (!id) throw new HttpsError("invalid-argument", "Randevu kodu gerekli.");
  const ref = db.doc("appointments/" + id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Randevu bulunamadı.");
    const data = snap.data()!;
    const adminSnap = await tx.get(db.doc("admins/" + uid));
    if (data.customerUid !== uid && !adminSnap.exists) throw new HttpsError("permission-denied", "Bu randevu size ait değil.");
    if (data.status !== "booked" || data.startAt.toDate().getTime() <= Date.now()) throw new HttpsError("failed-precondition", "Bu randevu iptal edilemiyor.");
    const slotRefs = (data.slotIds || []).map((slotId: string) => db.doc("slotLocks/" + slotId));
    const locks = await Promise.all(slotRefs.map((r: any) => tx.get(r)));
    tx.update(ref, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp(), cancelledBy: uid });
    locks.forEach((lock: any, i: number) => { if (lock.exists && lock.data()?.appointmentId === id) tx.delete(slotRefs[i]); });
  });
  return { ok: true };
});
export const adminSaveSettings = onCall({ region: REGION }, async request => {
  const uid = requireUid(request); await requireAdmin(uid);
  const d = request.data || {};
  if (!validClock(String(d.openTime)) || !validClock(String(d.closeTime)) || mins(d.openTime) >= mins(d.closeTime) ||
      !validClock(String(d.breakStart)) || !validClock(String(d.breakEnd)) || mins(d.breakStart) >= mins(d.breakEnd) ||
      !Number.isInteger(Number(d.slotMinutes)) || Number(d.slotMinutes) < 10 || Number(d.slotMinutes) > 120 ||
      !Array.isArray(d.daysOff) || d.daysOff.some((n: any) => !Number.isInteger(n) || n < 0 || n > 6)) {
    throw new HttpsError("invalid-argument", "Çalışma saati ayarları geçersiz.");
  }
  await db.doc("settings/business").set({ openTime: d.openTime, closeTime: d.closeTime, breakStart: d.breakStart, breakEnd: d.breakEnd, slotMinutes: Number(d.slotMinutes), daysOff: [...new Set(d.daysOff)], timeZone: ZONE, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true });
  return { ok: true };
});
export const adminUpdateAppointment = onCall({ region: REGION }, async request => {
  const uid = requireUid(request); await requireAdmin(uid);
  const id = String(request.data?.appointmentId || "");
  const status = String(request.data?.status || "");
  if (!id || !["cancelled", "completed"].includes(status)) throw new HttpsError("invalid-argument", "Geçersiz işlem.");
  const ref = db.doc("appointments/" + id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Randevu bulunamadı.");
    const data = snap.data()!;
    const slotRefs = status === "cancelled" && data.status === "booked" ? (data.slotIds || []).map((slotId: string) => db.doc("slotLocks/" + slotId)) : [];
    const locks = await Promise.all(slotRefs.map((r: any) => tx.get(r)));
    tx.update(ref, { status, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
    locks.forEach((lock: any, i: number) => { if (lock.exists && lock.data()?.appointmentId === id) tx.delete(slotRefs[i]); });
  });
  return { ok: true };
});
