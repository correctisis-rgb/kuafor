import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";

const green = "#142820";
const gold = "#D8BD8A";
const createAppointment = httpsCallable(functions, "createAppointment");
const cancelAppointment = httpsCallable(functions, "cancelAppointment");

function message(e: any) {
  const code = String(e?.code || "");
  if (code.includes("email-already-in-use")) return "Bu e-posta zaten kayıtlı.";
  if (code.includes("invalid-credential")) return "E-posta veya şifre hatalı.";
  if (code.includes("already-exists")) return "Bu saat dolu; lütfen başka saat seçin.";
  if (code.includes("failed-precondition")) return "Saat uygun değil veya işletme ayarları yapılmamış.";
  return e?.message || "Bir hata oluştu.";
}
function Field({ label, value, onChangeText, placeholder, secureTextEntry = false }: any) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput style={s.input} value={value} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={secureTextEntry} autoCapitalize="none" /></View>;
}
function Btn({ title, onPress, light = false }: any) {
  return <Pressable onPress={onPress} style={[s.btn, light && s.lightBtn]}><Text style={[s.btnText, light && s.lightText]}>{title}</Text></Pressable>;
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("sac-kesimi");
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toLocaleDateString("sv-SE"));
  const [time, setTime] = useState("10:00");
  const [notice, setNotice] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [admin, setAdmin] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async u => {
    setUser(u); setLoading(false);
    if (u) {
      import("firebase/firestore").then(async fs => {
        const snap = await fs.getDoc(fs.doc(db, "admins", u.uid));
        setAdmin(snap.exists());
      }).catch(() => setAdmin(false));
    } else setAdmin(false);
  }), []);
  useEffect(() => onSnapshot(collection(db, "services"), snap => setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((x: any) => x.active !== false)), () => setServices([])), []);
  useEffect(() => {
    if (!user) { setAppointments([]); return; }
    return onSnapshot(query(collection(db, "appointments"), where("customerUid", "==", user.uid), orderBy("startAt", "desc")), snap => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setAppointments([]));
  }, [user]);

  async function authAction() {
    setNotice("");
    try {
      if (register) {
        if (!name.trim()) throw new Error("Lütfen adınızı girin.");
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) { setNotice(message(e)); }
  }
  async function book() {
    setNotice("");
    try {
      await createAppointment({ serviceId, date, time, customerName: name.trim() || user?.displayName || user?.email || "Müşteri" });
      setNotice("Randevunuz oluşturuldu.");
    } catch (e: any) { setNotice(message(e)); }
  }
  async function cancel(id: string) {
    try { await cancelAppointment({ appointmentId: id }); setNotice("Randevu iptal edildi."); }
    catch (e: any) { setNotice(message(e)); }
  }
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={green} /></View>;
  if (!user) return <ScrollView contentContainerStyle={s.wrap}><StatusBar style="light" /><View style={s.hero}><Text style={s.brand}>HAKAN KUAFÖR</Text><Text style={s.subtitle}>Bakımlı görünüm, kusursuz hizmet.</Text></View><View style={s.panel}><Text style={s.heading}>{register ? "Hesap oluştur" : "Hoş geldiniz"}</Text>{register && <Field label="Ad Soyad" value={name} onChangeText={setName} placeholder="Adınız Soyadınız" />}<Field label="E-posta" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" /><Field label="Şifre" value={password} onChangeText={setPassword} placeholder="En az 6 karakter" secureTextEntry /><Btn title={register ? "Kayıt ol" : "Giriş yap"} onPress={authAction} /><Btn title={register ? "Giriş ekranına dön" : "Yeni hesap oluştur"} light onPress={() => setRegister(!register)} />{!!notice && <Text style={s.notice}>{notice}</Text>}</View></ScrollView>;
  return <ScrollView contentContainerStyle={s.wrap}><StatusBar style="light" /><View style={s.hero}><Text style={s.brand}>HAKAN KUAFÖR</Text><Text style={s.subtitle}>Merhaba, {user.email}</Text><Pressable onPress={() => signOut(auth)}><Text style={s.signout}>Çıkış yap</Text></Pressable></View><View style={s.panel}><Text style={s.heading}>Randevu al</Text><Field label="Ad Soyad" value={name} onChangeText={setName} placeholder="Adınız Soyadınız" /><Text style={s.label}>Hizmet</Text>{(services.length ? services : [{id:"sac-kesimi",name:"Saç kesimi",price:0,durationMinutes:30}]).map((v: any) => <Pressable key={v.id} onPress={() => setServiceId(v.id)} style={[s.choice, serviceId === v.id && s.choiceActive]}><Text style={s.choiceText}>{v.name} · {v.durationMinutes || 30} dk {v.price ? "· " + v.price + " ₺" : ""}</Text></Pressable>)}<Field label="Tarih (YYYY-AA-GG)" value={date} onChangeText={setDate} placeholder="2026-12-31" /><Field label="Saat (SS:DD)" value={time} onChangeText={setTime} placeholder="10:00" /><Btn title="Randevuyu onayla" onPress={book} /><Text style={s.heading}>Randevularım</Text>{appointments.map((a: any) => <View key={a.id} style={s.appointment}><Text style={s.choiceText}>{a.date} · {a.time} — {a.serviceName}</Text><Text style={s.small}>Durum: {a.status === "booked" ? "Onaylı" : a.status === "cancelled" ? "İptal" : "Tamamlandı"}</Text>{a.status === "booked" && <Btn title="İptal et" light onPress={() => cancel(a.id)} />}</View>)}{admin && <Text style={s.notice}>Yönetici hesabı algılandı. Yönetim işlemleri güvenli Cloud Functions üzerinden yürütülür; tam yönetici ekranı sonraki geliştirme adımındadır.</Text>}{!!notice && <Text style={s.notice}>{notice}</Text>}</View><Text style={s.footer}>Hakan Kuaför · Randevu sistemi</Text></ScrollView>;
}
const s = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: "#F6F4EF", paddingBottom: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: green, padding: 28, paddingTop: 50, paddingBottom: 32 },
  brand: { color: gold, fontSize: 27, fontWeight: "800", letterSpacing: 2 },
  subtitle: { color: "white", marginTop: 8, fontSize: 15 },
  signout: { color: gold, marginTop: 16, fontWeight: "700" },
  panel: { backgroundColor: "white", margin: 16, padding: 20, borderRadius: 16, gap: 8 },
  heading: { fontSize: 21, fontWeight: "800", color: green, marginTop: 10, marginBottom: 8 },
  field: { marginBottom: 8, gap: 6 },
  label: { color: green, fontWeight: "700", marginBottom: 3 },
  input: { borderWidth: 1, borderColor: "#D8DDD8", borderRadius: 10, padding: 12, backgroundColor: "white", color: "#1B2923" },
  btn: { backgroundColor: green, padding: 14, borderRadius: 10, alignItems: "center", marginVertical: 4 },
  btnText: { color: "white", fontWeight: "800" },
  lightBtn: { backgroundColor: "#F3EEE2", borderWidth: 1, borderColor: gold },
  lightText: { color: green },
  notice: { color: green, marginTop: 12 },
  choice: { padding: 12, borderWidth: 1, borderColor: "#D8DDD8", borderRadius: 10, marginVertical: 3 },
  choiceActive: { borderColor: gold, backgroundColor: "#FBF7ED" },
  choiceText: { color: green, fontWeight: "600" },
  small: { color: "#68736C", marginVertical: 5 },
  appointment: { padding: 12, borderRadius: 10, backgroundColor: "#F6F4EF", marginVertical: 5 },
  footer: { textAlign: "center", color: "#68736C", padding: 8 }
});
