# ลอยกระทงออนไลน์ (Online Loy Krathong)

เกมลอยกระทงสำหรับงานองค์กร: ผู้ร่วมงานสแกน QR บนมือถือ ตกแต่งกระทง พิมพ์คำอธิษฐาน แล้วกระทงไปลอยบนจอโปรเจกเตอร์ในงานแบบ real-time รองรับ 100–500 คนพร้อมกัน

| หน้า | URL | ใช้ทำอะไร |
|---|---|---|
| ผู้เล่น (มือถือ) | `/` | ใส่ชื่อ/แผนก → ตกแต่งกระทง → อธิษฐาน → ลอย, ดูแม่น้ำ, ส่งหัวใจ/ดอกไม้, บันทึกรูป |
| จอใหญ่ | `/screen/` | เปิดบนเครื่องที่ต่อโปรเจกเตอร์ แสดงแม่น้ำ + QR + ตัวนับ + พลุ + เพลง |
| Admin | `/admin/` | เปิด/ปิดการลอย, ยิงพลุ, ตั้ง cooldown/ชื่องาน/โลโก้, ซ่อน/ลบกระทง, สถิติ, Export CSV, Reset |

## ฟีเจอร์

- ไม่ต้อง login (ใช้ Firebase Anonymous Auth เบื้องหลัง), ภาษาไทย/English สลับได้
- ตกแต่งกระทงจากชิ้นส่วน: ฐาน 5 แบบ, ดอกไม้ 5 แบบ, เทียน/ธูป 4 แบบ, สี 6 สี (สไตล์ cartoon วาดด้วยโค้ด ไม่มีลิขสิทธิ์รูป)
- กรองคำหยาบไทย/อังกฤษอัตโนมัติ + Admin ซ่อนได้ทันที
- Cooldown ระหว่างการลอย ตั้งได้จาก Admin (default 3 นาที) บังคับที่ฝั่ง server ด้วย Security Rules
- จอใหญ่แสดงพร้อมกัน ~28 กระทง กระทงใหม่ขึ้นก่อนพร้อม bubble คำอธิษฐาน ที่เหลือวนเป็นรอบ
- เสียงทั้งหมดสังเคราะห์ด้วย Web Audio (ไม่มีไฟล์เพลงให้ติดลิขสิทธิ์)

## ค่าใช้จ่ายและข้อจำกัด (สำคัญ)

Firebase แผนฟรี (Spark) จำกัด **Realtime Database ได้ 100 connections พร้อมกัน** ถ้างานมีคนเกิน ~90 คนพร้อมกัน ให้อัปเกรดเป็น **Blaze (pay-as-you-go)** ก่อนวันงาน

- Blaze ยังได้โควตาฟรีเท่า Spark (เก็บข้อมูล 1 GB, download 10 GB/เดือน) งานขนาด 500 คนใช้ประมาณ 0.2–0.5 GB จึงน่าจะ **ไม่เสียเงินหรือเสียไม่กี่บาท**
- แนะนำตั้ง Budget alert ใน Google Cloud Console (เช่น 100 บาท) เพื่อความสบายใจ
- โค้ดตัดการเชื่อมต่อของมือถือที่พับจอเกิน 30 วินาทีอัตโนมัติ เพื่อไม่ให้กิน connection

## Setup ครั้งแรก (ทำตามทีละขั้น)

ต้องมี: Google account, คอมพิวเตอร์ที่ติดตั้ง [Node.js 20+](https://nodejs.org/) แล้ว

1. **สร้าง Firebase project** — ไปที่ <https://console.firebase.google.com> → Add project → ตั้งชื่อ (เช่น `loy-krathong-2569`) → ปิด Google Analytics ได้
2. **เปิด Realtime Database** — เมนู Build → Realtime Database → Create Database → เลือก location `asia-southeast1 (Singapore)` → Start in **locked mode**
3. **เปิด Authentication** — Build → Authentication → Get started → Sign-in method → เปิด **Anonymous** และ **Email/Password**
4. **สร้างบัญชี Admin** — Authentication → Users → Add user → ใส่ email/password ของกอล์ฟ → คัดลอกค่า **User UID**
5. **ให้สิทธิ์ Admin** — Realtime Database → Data → กด `+` ที่ root → Key `admins` → กด `+` อีกชั้น → Key = UID จากข้อ 4, Value = `true`
6. **เอาค่า config ของเว็บ** — Project settings (รูปเฟือง) → General → Your apps → กดไอคอน `</>` (Web) → ตั้งชื่อ → จะได้ค่า `firebaseConfig`
7. **ตั้งค่าในโปรเจกต์**
   ```bash
   npm install
   cp .env.example .env.local      # แล้วเปิด .env.local ใส่ค่าจากข้อ 6
   ```
   แก้ไฟล์ `.firebaserc` เปลี่ยน `demo-loy-kratong` เป็น Project ID ของกอล์ฟ
8. **Deploy**
   ```bash
   npx firebase login
   npm run deploy                  # build + อัปโหลดเว็บและ Security Rules
   ```
   จะได้ URL เช่น `https://loy-krathong-2569.web.app`
9. เข้า `https://<project>.web.app/admin/` → login → ตั้งชื่องาน, โลโก้, cooldown → กด **บันทึก**

## Checklist วันงาน

- [ ] เปิด `/screen/` บนเครื่องต่อโปรเจกเตอร์ → **คลิก 1 ครั้ง** (เปิดเสียง + เต็มจอ) และต่อลำโพง
- [ ] เปิด `/admin/` บนอีกเครื่อง/มือถือ
- [ ] ทดสอบลอย 1 กระทงด้วยมือถือตัวเอง แล้วกดซ่อนใน Admin ดูว่าหายจากจอ
- [ ] ถึงเวลาเริ่ม: กด **เปิดให้ลอย + ยิงพลุ**
- [ ] จบงาน: กด **ปิดการลอย + ยิงพลุ** → **Export CSV** เก็บคำอธิษฐานไว้
- [ ] Wi-Fi ในงาน: ผู้เล่นใช้ 4G/5G ได้ ถ้าใช้ Wi-Fi องค์กร ต้องไม่ block `*.firebaseio.com`, `*.firebasedatabase.app`, `*.googleapis.com`, `fonts.gstatic.com` (WebSocket ขาออก port 443)

ตัวเลือกจอใหญ่ทาง URL: `/screen/?max=20` (จำนวนกระทงบนจอ ลดได้ถ้าเครื่องช้า), `?qr=0` (ซ่อน QR), `?url=https://...` (ให้ QR ชี้ไปลิงก์อื่น เช่น short link)

ปีหน้า: Admin → **Reset ข้อมูลทั้งหมด** (พิมพ์ `RESET` ยืนยัน)

## สำหรับนักพัฒนา: รันบนเครื่องโดยไม่ใช้ Firebase จริง

ต้องมี Java 11+ สำหรับ Firebase Emulator

```bash
npm install
npm run emulators            # terminal 1: Firebase Emulator (auth + database)
npm run dev:emu              # terminal 2: เว็บที่ http://localhost:5173
npm run seed -- --kratongs 200   # สร้าง admin@example.com / admin1234 + กระทงตัวอย่าง
```

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | unit tests (ตัวกรองคำหยาบ, คิวกระทง, CSV) |
| `npm run test:rules` | ทดสอบ Security Rules บน emulator |
| `npm run test:e2e` | ทดสอบ flow จริงบน browser (Playwright) |
| `npm run seed -- --live 500 --over 60` | จำลอง 500 คนลอยกระทงภายใน 60 วินาที |
| `npm run typecheck` / `npm run build` | ตรวจ type / build production |

### โครงสร้างโค้ด

```
index.html, screen/, admin/      หน้าเว็บ 3 หน้า (Vite multi-page)
src/kratong/    ชิ้นส่วนกระทงและการวาด (canvas, cache เป็น sprite)
src/river/      ฉากแม่น้ำ + scheduler คิวกระทง (ใช้ทั้งจอใหญ่และมือถือ)
src/effects/    พลุ, หัวใจ/ดอกไม้
src/data.ts     อ่าน/เขียน Firebase
database.rules.json   Security Rules (cooldown, เปิด/ปิด, สิทธิ์ admin, validate ข้อมูล)
```
