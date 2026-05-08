// ╔══════════════════════════════════════════════════════════╗
// ║  請將此檔案的設定值換成你的 Firebase 專案資料            ║
// ║  步驟：Firebase Console → 專案設定 → 新增網頁應用程式   ║
// ╚══════════════════════════════════════════════════════════╝

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyXXXXXXXXXX",
  authDomain: "topchurch-scheduler.firebaseapp.com",
  databaseURL: "https://topchurch-scheduler-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "topchurch-scheduler",
  storageBucket: "topchurch-scheduler.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// 管理員帳號（用 Firebase Authentication Email/Password）
// 在 Firebase Console → Authentication → 新增使用者 設定
const ADMIN_EMAIL_DOMAIN = ""; // 選填：限制只有此網域的 email 可登入，例如 "topchurch.org.tw"
