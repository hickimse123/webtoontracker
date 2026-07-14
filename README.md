# Webtoon Ekip Kontrol Sitesi

Bu, webtoon ve manga fan-çeviri (scanlation) ekiplerinin tüm iş akışını, bölüm durumlarını ve görev dağılımlarını tek bir çatı altında, gerçek zamanlı olarak yönetebilmeleri için tasarlanmış, oyunlaştırılmış (gamified) bir ekip takip panelidir. 

Firebase entegrasyonu sayesinde veriler anlık olarak güncellenir ve ekip üyeleri yaptıkları görevlerden puan ve coin kazanarak profillerini özelleştirebilirler.

---

## 🔥 Öne Çıkan Özellikler

### 📋 1. Gelişmiş İş Akışı ve Bölüm Takibi
*   **7 Aşamalı Bölüm Durumu:** Bir bölümün durumu `Ham Bulundu` ➡️ `Çeviride` ➡️ `Temizlikte` ➡️ `Redaksiyonda` ➡️ `Dizgide` ➡️ `Kalite Kontrolde` ve `Yayında (Tamamlandı)` aşamalarıyla anlık olarak takip edilebilir.
*   **Çalışma Klasörleri:** Her bölümün ham veya bitmiş dosyalarına hızlıca erişmek için doğrudan çalışma klasörü (`folderUrl`) bağlantısı eklenebilir.

### 🎖️ 2. Rol ve Rütbe Sistemi
*   **Hiyerarşik Ekip Rolleri:** Kullanıcılar uzmanlık alanlarına göre roller alır:
    *   *Admin, Çevirmen, Redaktör, Dizgici, Kalite Kontrol, Temizlikçi, Raw Bulucu ve Üye.*
*   **Puana Göre Pilot Rütbeleri:** Üyeler görev tamamladıkça puan kazanır ve otomatik olarak rütbe atlar:
    1.  `Acemi Yolcu` (0+ Puan)
    2.  `İkinci Pilot` (80+ Puan)
    3.  `Kaptan Pilot` (250+ Puan)
    4.  `Filo Komutanı` (600+ Puan)
    5.  `Hava Sahası Efsanesi` (1200+ Puan)

### 🪙 3. Ekonomi & Dükkan (Shop)
*   **Ekip İçi Coin Transferi:** Üyeler birbirlerine teşekkür etmek veya yardımlaşmak için kendi aralarında coin transfer edebilirler.
*   **Profil Özelleştirme:** Kazanılan coinler ile dükkandan **15 farklı Profil Çerçevesi** veya **15 farklı parıltılı/animasyonlu İsim Efekti** satın alınabilir.

### 🎰 4. Eğlence Odası (Minigames)
Ekip üyelerinin dinlenirken coin kazanabileceği veya kaybedebileceği 3 farklı entegre oyun:
*   **Çarkıfelek (Wheel):** Yatırılan coin miktarını katlama şansı sunan klasik çark oyunu.
*   **Mayın Tarlası (Mines):** Mayına basmadan kareleri açarak çarpanı yükselttiğiniz risk/ödül oyunu.
*   **XOX (AI Karşı):** Yapay zekaya karşı oynanan ve oyuncu oynadıkça botun hata yapma payının dinamik olarak değiştiği gelişmiş XOX sistemi.

### 🛡️ 5. Güçlü Yönetim (Admin) Paneli
Admin rolüne sahip kullanıcılar için özel yönetim sekmesi:
*   **Kullanıcı Yönetimi:** Üyelerin rollerini tek tıkla değiştirme, puan/coin ekleme veya çıkarma.
*   **Seri ve Bölüm Ekleme:** Yeni seriler tanımlama, serilere sabit ekip atama ve bölümler açma.
*   **UI Özelleştirme:** Sitenin başlığını, karşılama metinlerini, logo görselini ve tema rengini (accent color) doğrudan panel üzerinden değiştirme.

---

## 🛠️ Kullanılan Teknolojiler

*   **Frontend:** HTML5, CSS3, Tailwind CSS (Modern ve esnek arayüz), FontAwesome 6+ (Zengin ikon arayüzü)
*   **Database & Auth:** Google Firebase (Firestore, Authentication)
*   **API:** DiceBear (Dinamik ve şık avatar oluşturucu)

---

## 🚀 Kurulum ve Çalıştırma

Bu kod tamamen istemci taraflı (client-side) çalışan, birleştirilmiş tek bir `app.js` mimarisine sahiptir. Sunucu kurulumu gerektirmeden hızlıca yayına alınabilir.

### 1. Firebase Projesi Oluşturma
1.  [Firebase Console](https://console.firebase.google.com/) adresine gidin ve yeni bir proje oluşturun.
2.  **Authentication** servisini aktif edin ve `Email/Password` giriş yöntemini açın.
3.  **Cloud Firestore** veritabanını oluşturun (Production veya Test modunda başlatabilirsiniz).
4.  Proje ayarlarından bir **Web App** ekleyin ve size verilen Firebase yapılandırma nesnesini (Config) kopyalayın.

### 2. Yapılandırma Güncellemesi
`app.js` dosyasının en üstünde yer alan `firebaseConfig` alanını kendi Firebase bilgilerinizle değiştirin:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

```

### 3. Firestore Kuralları (Rules)
Verilerin güvenli ve stabil çalışması için Firestore kurallarınızı aşağıdaki gibi düzenleyebilirsiniz:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function getUserRoles() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roles;
    }
    
    function isAdmin() {
      return isSignedIn() && 'admin' in getUserRoles();
    }

    function isStaff() {
      return isSignedIn() && (
        'admin' in getUserRoles() || 
        'translator' in getUserRoles() || 
        'editor' in getUserRoles() || 
        'cleaner' in getUserRoles()
      );
    }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() 
                    && request.auth.uid == userId 
                    && request.resource.data.roles.hasAll(['member']);
      allow update: if isAdmin() || (request.auth.uid == userId && request.resource.data.roles == resource.data.roles);
      allow delete: if isAdmin();
    }

    match /series/{seriesId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /chapters/{chapterId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isStaff();
    }

    match /settings/{document} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /tasks/{taskId} {
      allow read: if isSignedIn();
      allow create, delete: if isAdmin();
      allow update: if isStaff();
    }

    match /achievements/{achievementId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /userAchievements/{userAchievementId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
  }
}

```

### 4. Yayına Alma (Deployment)

Projeyi yerel bilgisayarınızda çift tıklayarak çalıştırabilir veya ücretsiz hosting servislerini kullanabilirsiniz:

* **GitHub Pages:** Deponuzun ayarlarından (Settings -> Pages) ana dalı (main/master) seçerek saniyeler içinde yayına alabilirsiniz.
* **Firebase Hosting:** `firebase init` ve `firebase deploy` komutlarıyla doğrudan Firebase altyapısında barındırabilirsiniz.

---

## 🤝 Katkıda Bulunma

1. Bu depoyu forklayın (`fork`).
2. Yeni bir özellik dalı açın (`git checkout -b yeni-ozellik`).
3. Değişikliklerinizi kaydedin (`git commit -am 'Yeni özellik eklendi'`).
4. Dala push yapın (`git push origin yeni-ozellik`).
5. Bir Çekme İsteği (Pull Request) oluşturun.

---

## 📄 Lisans

Bu proje **MIT Lisansı** altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına göz atabilirsiniz.


---

### 💡 Ekip İçin Küçük Bir İpucu
`app.js` dosyasındaki Firebase config değeriniz içinde bulunan API anahtarı gibi kritik verileri GitHub'a yüklemeden önce gizlemek isteyebilirsiniz. Ancak statik bir proje olduğu için kodun çalışması adına bu bilgilerin tarayıcı tarafından okunması gerekir. Eğer açık bir depoda (Public Repo) paylaşacaksanız, Firebase güvenlik kurallarınızı (Rules) doğru yapılandırdığınızdan emin olmanız önemlidir[cite: 1].

```
