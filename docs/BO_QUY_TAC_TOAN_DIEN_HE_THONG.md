# 🛡️ BỘ QUY TẮC TOÀN DIỆN HỆ THỐNG & CHÍNH SÁCH QUYỀN RIÊNG TƯ
> **Dự án:** Mô Phỏng & Sát Hạch Lái Xe Sa Hình 3D (React / Three.js / Firebase)  
> **Phiên bản:** 2.0 (Tháng 10/2026) | **Tác giả:** Đội ngũ phát triển hệ thống  

---

## 📑 Mục Lục Toàn Diện (10 Phần)
1. [Phần 1: Bộ Quy Tắc Bảo Mật Mã Nguồn & Hệ Thống (Developer Security Rules)](#phần-1-bộ-quy-tắc-bảo-mật-mã-nguồn--hệ-thống)
2. [Phần 2: Chính Sách Quyền Riêng Tư Chuẩn (Privacy Policy)](#phần-2-chính-sách-quyền-riêng-tư-privacy-policy)
3. [Phần 3: Checklist Bảo Mật Nhanh 17 Bước Trước Khi Deploy](#phần-3-checklist-bảo-mật-nhanh-17-bước-trước-khi-deploy)
4. [Phần 4: Bộ Quy Tắc Chống Gian Lận & Hack Game (Anti-Cheat & Checkpoints)](#phần-4-bộ-quy-tắc-chống-gian-lận--hack-game)
5. [Phần 5: Điều Khoản Dịch Vụ & Miễn Trừ Trách Nhiệm (Terms of Service)](#phần-5-điều-khoản-dịch-vụ--miễn-trừ-trách-nhiệm)
6. [Phần 6: Kiểm Soát Chi Phí Đám Mây & Ứng Phó Sự Cố (Budget & Incident Plan)](#phần-6-kiểm-soát-chi-phí-đám-mây--ứng-phó-sự-cố)
7. [Phần 7: Quản Lý Mã Nguồn, Secret Keys & Git (DevOps Safety)](#phần-7-quản-lý-mã-nguồn-secret-keys--git)
8. [Phần 8: Bảo Vệ Tài Nguyên 3D & Chống Tràn Bộ Nhớ (Three.js Memory Safety)](#phần-8-bảo-vệ-tài-nguyên-3d--chống-tràn-bộ-nhớ)
9. [Phần 9: Bộ Quy Tắc Thương Mại Điện Tử, Thanh Toán & Đổi Trả (E-Commerce & Payments)](#phần-9-bộ-quy-tắc-thương-mại-điện-tử-thanh-toán--đổi-trả)
10. [Phần 10: Bộ Quy Tắc Code Web Dành Cho Dev Android (Android vs Web Cheat Sheet)](#phần-10-bộ-quy-tắc-lập-trình-web-chuẩn-dành-cho-dev-android)

---

## Phần 1: Bộ Quy Tắc Bảo Mật Mã Nguồn & Hệ Thống

### 1. Xác thực & Bảo vệ Mật khẩu
- **CẤM lưu mật khẩu thô (Plaintext):** Tuyệt đối không lưu mật khẩu thô trong LocalStorage, SessionStorage hay Database.
- **Thuật toán băm PBKDF2:** Áp dụng tối thiểu 100.000 vòng lặp (iterations) kết hợp chuỗi Salt ngẫu nhiên 16 bytes từ `crypto.getRandomValues`. Cấm dùng MD5/SHA-1 hay SHA-256 thuần.
- **Tự động chuyển đổi (Auto-migration):** Tự động nâng cấp hash mật khẩu cũ sang PBKDF2 khi người dùng đăng nhập lại thành công.

### 2. Chống Brute-force & Quản lý Phiên
- **Rate Limit:** Tối đa 5 lần thử sai liên tiếp. Lần thứ 6 sẽ khóa đăng nhập 5 phút (300.000ms). Reset bộ đếm khi đăng nhập đúng.
- **Session TTL:** Phiên làm việc lưu cục bộ bắt buộc có mốc `expiresAt` (24 giờ). Tự động dọn rác và đăng xuất khi hết hạn.
- **Ẩn lỗi thô:** Cấm in stack trace, `err.message` nội bộ lên UI hoặc console trình duyệt trong môi trường Production.

### 3. Phân quyền Database (Firestore Security Rules)
- **Least Privilege:** Mặc định từ chối mọi truy cập (`allow read, write: if false;`).
- **Tách `get` và `list` trên bảng `vip_keys`:** Cho phép `get` 1 mã cụ thể để kích hoạt, nhưng cấm tuyệt đối học viên chạy lệnh `list` quét danh sách mã VIP chưa dùng.
- **Bảo vệ Master Admin:** Bắt buộc kiểm tra `request.auth.token.email_verified == true`.
- **Bất biến lịch sử thi (`exam_records`):** Đặt `allow update: if false;` để cấm sửa đổi kết quả thi sau khi đã lưu.

### 4. Validate Dữ liệu Đầu vào Tầng Database
- Kiểm tra kiểu dữ liệu chuỗi `displayName` (1–100 ký tự), `licenseClass` (≤10 ký tự), `email` (≤150 ký tự).
- Khống chế thang điểm thi `finalScore` chặt chẽ từ 0 đến 100 và trường `passed` bắt buộc là kiểu `bool`.

### 5. Bảo mật Mạng & Headers
- Bắt buộc HTTPS qua thẻ meta `upgrade-insecure-requests` và cấu hình HSTS (`max-age=31536000`).
- Chống Clickjacking (`X-Frame-Options: SAMEORIGIN`) và chặn MIME sniffing (`nosniff`).
- Khóa quyền truy cập phần cứng (`Permissions-Policy: camera=(), microphone=(), geolocation=()`).

### 6. Xóa Debug khi Build Production
- Cấu hình Rolldown/Oxc Rust: `dropConsole: true` và `dropDebugger: true` để dọn sạch 100% lệnh `console.log` khi xuất bản production.

---

## Phần 2: Chính Sách Quyền Riêng Tư (Privacy Policy)
*(Áp dụng chính thức theo Nghị định 13/2023/NĐ-CP và chính sách Google AdSense)*

- **Dữ liệu thu thập:** Chỉ thu thập Email, Tên hiển thị, Hạng bằng lái và Điểm số bài thi khi người dùng chủ động đăng ký tài khoản. Người chơi thử không cần cung cấp bất kỳ thông tin nào.
- **Cam kết KHÔNG thu thập:** Không đòi quyền Micro, Camera, Danh bạ, Tin nhắn, GPS hay mã định danh phần cứng (IMEI, MAC).
- **Google AdSense & Cookie DART:** Khai báo cookie bên thứ ba phục vụ quảng cáo và hướng dẫn người dùng tắt quảng cáo cá nhân hóa tại [adssettings.google.com](https://adssettings.google.com).
- **Lưu trữ & Tự hủy:** Kết quả thi sa hình trên máy chủ tự động được dọn rác định kỳ sau 3 giờ để bảo vệ quyền riêng tư.
- **Quyền Xóa Tài Khoản (Data Deletion):** Học viên có quyền yêu cầu xóa vĩnh viễn dữ liệu qua email `phucnam995@gmail.com` (tiến hành xóa trong vòng 48 giờ làm việc).

---

## Phần 3: Checklist Bảo Mật Nhanh 17 Bước Trước Khi Deploy
```markdown
[ ] 1. Mật khẩu lưu trữ: Đã kiểm tra không còn trường pass dạng plaintext nào.
[ ] 2. Thuật toán băm: Đã kích hoạt PBKDF2 100K iterations + crypto random salt.
[ ] 3. Rate Limit đăng nhập: Đã bật khóa 5 phút sau 5 lần nhập sai mật khẩu.
[ ] 4. Session TTL: Đã gắn thời hạn 24 giờ cho phiên làm việc của người dùng.
[ ] 5. Lỗi giao diện: Đã xóa mọi console.error và ẩn chi tiết lỗi thô ra UI.
[ ] 6. Firestore Rules: Đã kiểm tra email_verified của Admin và cấm list trên bảng vip_keys.
[ ] 7. Data Validation: Đã khống chế thang điểm thi (0-100) và độ dài tên hiển thị (1-100 ký tự).
[ ] 8. HTTPS & Headers: Đã có thẻ meta upgrade-insecure-requests và 5 headers trong firebase.json.
[ ] 9. Xóa Debug Build: Đã chạy npm run build và kiểm tra bundle không còn lệnh console.log.
[ ] 10. Privacy Policy & Terms: Đã có link công khai Chính sách Quyền riêng tư và Điều khoản dịch vụ.
[ ] 11. Anti-Cheat Checkpoints: Đã kích hoạt cơ chế đối chiếu tiến trình bài thi theo trình tự.
[ ] 12. Giới hạn lượt chơi: Đã cấu hình đối chiếu daily_usage trên Firestore, chống hack client.
[ ] 13. Cảnh báo chi phí: Đã cài đặt Budget Alert trên Google Cloud Console (ngưỡng 5$, 10$).
[ ] 14. Kiểm tra Git Secrets: Đã kiểm tra .gitignore không commit file .env hay service account.
[ ] 15. Dọn dẹp bộ nhớ 3D: Đã gọi dispose() giải phóng Texture/Geometry khi thoát bài thi.
[ ] 16. Webhook Thanh toán: Webhook cổng thanh toán đã xác minh chữ ký HMAC SHA-256 từ Backend.
[ ] 17. Thông tin Pháp lý TMĐT: Đã công khai thông tin thương nhân, chính sách giá, hoàn tiền.
```

---

## Phần 4: Bộ Quy Tắc Chống Gian Lận & Hack Game (Anti-Cheat)
1. **Kiểm tra Checkpoint liên tục:** Bài thi 11 sa hình phải đi qua các mốc tuần tự. Hủy kết quả nếu thời gian hoàn thành dưới ngưỡng tối thiểu hợp lý (Minimum Plausible Time).
2. **Khống chế vận tốc xe:** Giới hạn tốc độ xe tối đa trong engine vật lý (không vượt quá 30 km/h hạng B, 24 km/h hạng C).
3. **Chống hack lượt chơi:** Luôn đối chiếu số lượt chơi với Firestore `daily_usage`, không tin tưởng số liệu đơn thuần từ LocalStorage.
4. **Chống bypass quảng cáo thưởng:** Chỉ cộng lượt chơi khi nhận được callback `adViewed` từ Google AdSense AFG.
5. **Chống dò mã VIP:** Giới hạn thử sai mã VIP tối đa 3 lần trong 10 phút.

---

## Phần 5: Điều Khoản Dịch Vụ & Miễn Trừ Trách Nhiệm
1. **Mục đích mô phỏng tham khảo:** Ứng dụng không thay thế cho chương trình đào tạo sát hạch thực tế tại các trung tâm sát hạch được cấp phép.
2. **Miễn trừ trách nhiệm:** Ban Quản Trị không chịu trách nhiệm pháp lý hoặc vật chất đối với kết quả thi thực tế hoặc sự cố giao thông ngoài đời thực.
3. **Bản quyền tài sản 3D:** Mô hình 3D, âm thanh, thuật toán sa hình thuộc quyền sở hữu trí tuệ của tác giả, nghiêm cấm trích xuất hoặc dịch ngược thương mại.
4. **Khóa tài khoản:** Có quyền khóa vĩnh viễn tài khoản có hành vi gian lận, phá hoại hoặc spam máy chủ.

---

## Phần 6: Kiểm Soát Chi Phí Đám Mây & Ứng Phó Sự Cố
1. **Cảnh báo ngân sách (Budget Alert):** Thiết lập ngưỡng cảnh báo 50%, 90%, 100% ngân sách (ví dụ: 5$, 10$) trên Google Cloud Billing.
2. **Giới hạn truy vấn:** Mọi truy vấn đọc lịch sử Firestore đều phải có `.limit(10)` hoặc `.limit(20)`.
3. **Quy trình 3 bước xử lý sự cố:**
   - **Bước 1 (Cách ly):** Khóa tạm thời bảng dữ liệu bị tấn công trên `firestore.rules`.
   - **Bước 2 (Thu hồi):** Đổi mật khẩu Admin và hủy toàn bộ session token.
   - **Bước 3 (Phục hồi):** Xuất dữ liệu Firestore ra Cloud Storage và khôi phục.

---

## Phần 7: Quản Lý Mã Nguồn, Secret Keys & Git
1. **Bảo vệ file `.gitignore`:** Chặn commit `.env`, `*.pem`, `*.key`, `serviceAccountKey.json`.
2. **Phân biệt Public Config vs Private Secret:** Firebase Web Config là công khai, độ an toàn phụ thuộc vào `firestore.rules`. Cấm nhúng Service Account JSON vào Frontend.

---

## Phần 8: Bảo Vệ Tài Nguyên 3D & Chống Tràn Bộ Nhớ
1. **Giải phóng bộ nhớ GPU khi unmount:**
   ```typescript
   mesh.geometry.dispose();
   if (Array.isArray(mesh.material)) {
     mesh.material.forEach(m => m.dispose());
   } else {
     mesh.material.dispose();
   }
   if (texture) texture.dispose();
   renderer.dispose();
   ```
2. **Tạm dừng render khi ẩn tab (`Page Visibility API`):** Khi `document.hidden == true`, tạm dừng vòng lặp `requestAnimationFrame` để tiết kiệm pin và tránh nóng máy.

---

## Phần 9: Bộ Quy Tắc Thương Mại Điện Tử, Thanh Toán & Đổi Trả
1. **Pháp lý TMĐT Việt Nam:** Làm thủ tục thông báo website TMĐT bán hàng với Bộ Công Thương (Nghị định 52/2013/NĐ-CP & 85/2021/NĐ-CP). Công khai thông tin thương nhân, MST, hotline và bảng giá niêm yết bằng VNĐ.
2. **Bảo mật thanh toán & Chuẩn PCI-DSS:** Không lưu số thẻ và CVV. Tích hợp cổng thanh toán trung gian đạt chuẩn PCI-DSS Level 1 (VNPAY, MoMo, ZaloPay, PayOS, Stripe, IAP).
3. **Xác thực Webhook Backend:** Kiểm tra chữ ký HMAC SHA-256 từ cổng thanh toán, đối chiếu số tiền `amount`, cấm duyệt VIP từ phía Client.
4. **Chính sách hoàn tiền:** Hoàn 100% trong vòng 24 giờ đối với gói VIP chưa kích hoạt. Xử lý hoàn tiền trong vòng 3-7 ngày làm việc.
5. **Hóa đơn điện tử:** Xuất hóa đơn điện tử theo Thông tư 78/2021/TT-BTC khi có yêu cầu; lưu trữ dữ liệu tài chính tối thiểu 5 năm theo Luật Kế toán.

---

## Phần 10: Bộ Quy Tắc Lập Trình Web Chuẩn Dành Cho Dev Android

### 1. Bảng Tra Cứu Nhanh (Android ➡️ Web)
| Khái niệm trên Android Native | Tương đương trên Web (React/TS) | Điểm khác biệt mấu chốt cần lưu ý |
|---|---|---|
| **Activity/Fragment Lifecycle** | `useEffect()` + hàm return cleanup | Web không có `onDestroy`, bắt buộc return cleanup để hủy listener |
| **ViewModel + StateFlow** | React Context + `useState` | Khi `useState` đổi giá trị, toàn bộ component sẽ **re-render** |
| **Biến trạng thái không re-render** | `useRef()` | **Cực kỳ quan trọng:** Game loop 60 FPS Three.js **phải** dùng `useRef` |
| **SharedPreferences / DataStore** | `localStorage` / `sessionStorage` | Chạy đồng bộ (blocking), giới hạn ~5MB, chỉ lưu chuỗi string |
| **Room Database (SQLite)** | `IndexedDB` | Bất đồng bộ, lưu trữ dung lượng lớn, hỗ trợ file nhị phân/Blob |
| **XML Layout / Jetpack Compose** | JSX + Tailwind CSS / Flexbox / Grid | Box-model CSS, `flex-col`/`flex-row` thay cho `Column`/`Row` |
| **dp, sp (Density pixel)** | `rem`, `em`, `px`, `clamp()` | Mặc định Web lấy `1rem = 16px` làm gốc tỉ lệ |
| **OnTouchListener / MotionEvent** | Pointer Events (`pointerdown`/`up`/`move`) | Chuẩn thống nhất cho cả Chuột, Cảm ứng điện thoại và Bút Stylus |
| **Coroutine (`viewModelScope`)** | `async / await`, `Promise` | JavaScript chạy đơn luồng dựa trên cơ chế Event Loop |
| **Logcat (`Log.d`, `Log.e`)** | `console.log`, `console.error` | Phải cấu hình minifier gỡ bỏ 100% khi build Production |
| **ProGuard / R8 Obfuscation** | Vite / Rolldown / Oxc Minifier | Nén code, tối ưu tree-shaking và xóa sạch lệnh debug |

### 2. Tránh Bẫy Re-render Khi Làm Game 3D (`useState` vs `useRef`)
- **Sai lầm phổ biến:** Lưu biến tọa độ, vận tốc, góc lái bằng `useState` trong vòng lặp 60 FPS ➡️ React re-render 60 lần/giây gây giật lag và đơ giao diện.
- **Quy tắc:** Mọi dữ liệu vật lý 3D cập nhật liên tục **bắt buộc dùng `useRef`** (`carRef.current.speed = ...`). Chỉ dùng `useState` khi muốn hiển thị dữ liệu lên thẻ HTML.

### 3. Cleanup trong `useEffect`
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => { /* Xử lý phím */ };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown); // BẮT BUỘC DỌN DẸP
}, []);
```

### 4. Cảm Ứng Di Động & Vùng Tai Thỏ
- Dùng **Pointer Events** (`onPointerDown`, `onPointerUp`) để phản hồi tức thì.
- Thêm CSS `touch-action: none;` để chặn zoom đúp; `overscroll-behavior: none;` chặn vuốt reload trang; `user-select: none;` chặn bôi đen chữ.
- Xử lý tai thỏ (Notch): Thêm `viewport-fit=cover` và dùng CSS `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`.
