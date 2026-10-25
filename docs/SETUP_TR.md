# Hakan Kuaför — Kurulum Rehberi

## 1. Gerekenler
- Node.js 20 LTS ve npm
- Firebase CLI: `npm install -g firebase-tools`
- Firebase projesi
- Android için Expo Go veya Android Studio

## 2. Firebase yapılandırması
1. Firebase Console'da proje oluşturun.
2. Authentication → Sign-in method bölümünde Email/Password yöntemini açın.
3. Project settings → Your apps bölümünden Web App ekleyin.
4. Web yapılandırma değerlerini `src/firebase.ts` içindeki `firebaseConfig` alanına yazın.
5. Firestore Database oluşturun. Cloud Functions bölgesi bu projede `europe-west1`.

## 3. Firestore başlangıç verileri
Firestore Data bölümünde `settings/business` belgesi oluşturun:
```json
{ "openTime":"09:00", "closeTime":"18:00", "breakStart":"12:30", "breakEnd":"13:30", "slotMinutes":30, "daysOff":[0], "timeZone":"Europe/Istanbul" }
```
Hizmet belgeleri örnekleri:
- `services/sac-kesimi`: `{ "name":"Saç kesimi", "durationMinutes":30, "price":300, "active":true }`
- `services/sakal`: `{ "name":"Sakal tıraşı", "durationMinutes":30, "price":150, "active":true }`
- `services/sac-sakal`: `{ "name":"Saç + sakal", "durationMinutes":60, "price":400, "active":true }`

## 4. Yönetici hesabı
Uygulamadan kullanıcı kaydı oluşturun ve Firebase Authentication ekranından UID değerini alın. Güvenilir bir bilgisayarda Firebase Admin SDK ile `admins/UID` belgesi oluşturun. İstemci uygulamasından yönetici belgesi oluşturmayın. Yönetici yetkisi bu belgeyle denetlenir.

## 5. Dağıtım
Proje kökünde:
```bash
npm install
npm install --prefix functions
npm run typecheck
npm run --prefix functions build
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,functions
npx expo export --platform web
firebase deploy --only hosting
```
Cloud Functions dağıtımı için Firebase faturalandırma hesabı gerekebilir. Hosting `dist` klasörünü kullanır.

## 6. Android
```bash
npx expo start
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
```

## 7. Güvenlik ve üretim öncesi
- Admin SDK anahtarlarını istemciye koymayın.
- Firebase App Check, e-posta doğrulama, parola sıfırlama ve hesap silme akışlarını ekleyin.
- Randevu slot kilitleri 15 dakikalık aralıklarla çakışmayı engeller; üretim öncesinde saat dilimi, hizmet süresi ve kenar durumlarını test edin.
- Admin listesi ve müşteri kişisel verileri için KVKK metinlerini ve erişim kontrollerini tamamlayın.
- Firestore Emulator ile randevu oluşturma/iptal ve yetki testlerini yapın.

Bu depo uygulama kaynaklarını içerir; Firebase yapılandırması ve dağıtım tamamlanmadan canlı hizmet değildir.
