// ╔══════════════════════════════════════════════════════════╗
// ║  請將此檔案的設定值換成你的 Firebase 專案資料            ║
// ║  步驟：Firebase Console → 專案設定 → 新增網頁應用程式   ║
// ╚══════════════════════════════════════════════════════════╝

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBESRqa_nKU0UaESlkxuxCPlnM0y61yZZ0",
  authDomain:        "topchurch-scheduler.firebaseapp.com",
  databaseURL:       "https://topchurch-scheduler-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "topchurch-scheduler",
  storageBucket:     "topchurch-scheduler.firebasestorage.app",
  messagingSenderId: "130468282879",
  appId:             "1:130468282879:web:000879583cb9333300e7ca"
};

// 管理員帳號（用 Firebase Authentication Email/Password）
// 在 Firebase Console → Authentication → 新增使用者 設定
const ADMIN_EMAIL_DOMAIN = ""; // 選填：限制只有此網域的 email 可登入，例如 "topchurch.org.tw"
