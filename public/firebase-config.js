// ╔══════════════════════════════════════════════════════════╗
// ║  請將此檔案的設定值換成你的 Firebase 專案資料            ║
// ║  步驟：Firebase Console → 專案設定 → 新增網頁應用程式   ║
// ╚══════════════════════════════════════════════════════════╝

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// 管理員帳號（用 Firebase Authentication Email/Password）
// 在 Firebase Console → Authentication → 新增使用者 設定
const ADMIN_EMAIL_DOMAIN = ""; // 選填：限制只有此網域的 email 可登入，例如 "topchurch.org.tw"
