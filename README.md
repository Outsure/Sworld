# Wedding IG Wall

เว็บสำหรับงานแต่ง: แขกสแกน QR > กรอกชื่อ / IG / รูป > ขึ้นจอ Display อัตโนมัติ

## วิธีใช้

1. ติดตั้ง Node.js 18+
2. เปิด Terminal ในโฟลเดอร์นี้
3. รันคำสั่ง

```bash
npm install
npm start
```

4. เปิดใช้งาน
- หน้ากรอกข้อมูล: `http://localhost:3000/join.html`
- หน้าจอแสดงผล: `http://localhost:3000/display.html`
- หน้าแอดมิน: `http://localhost:3000/admin.html`

## ถ้าจะขึ้นโดเมนจริง

ตัวอย่าง deploy บน Render / Railway / VPS

ตั้งค่า environment variable:

```bash
BASE_URL=https://your-domain.com
PORT=3000
```

จากนั้นชี้โดเมนจริงมาที่ server นี้ เช่น
- `wedding.yourname.com`
- `ig.yournamewedding.com`
- `afterparty.yourname.com`

## หมายเหตุ

- ตอนนี้เป็นเวอร์ชันเก็บข้อมูลใน `data.json`
- เหมาะกับงานขนาดเล็กถึงกลาง
- ถ้างานใหญ่จริง แนะนำเปลี่ยนเป็น database เช่น Supabase / Firebase
