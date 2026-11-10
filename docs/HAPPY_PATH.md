# Text Contrast MVP — Happy path

เปิด http://localhost:3123 แล้วกด **Run Text Contrast MVP**

1. Code วัด 4 กรณีบน rendered DOM ที่ viewport 375×667
2. ระบบส่งหลักฐานของ candidate issue ให้ CPE LLM อัตโนมัติ
3. อ่านการวัดและคำแนะนำใน Issue card: badge ต้องเป็น AI-Generated (CPE · model)
4. Designer เลือก Accept/Reject/Edit/Reprioritize และบันทึกเหตุผล
5. Export JSON หรือ Markdown เพื่อเก็บ evidence, provenance และ decision history

Metric รอบนี้มีเพียง text contrast: normal-pass, normal-fail, large-pass, gradient-review
Pass ไม่ต้องแก้; gradient เป็น needsReview การยอมรับคำแนะนำไม่ได้แปลว่าแก้ CSS หรือวัดซ้ำแล้ว

CPE ใช้ server-side `.env.local`: CPE_API_BASE_URL, CPE_API_KEY, CPE_MODEL
ห้ามใช้ NEXT_PUBLIC_ prefix กับ secret ตัวเชื่อมอยู่ที่ `src/lib/ai/cpe-adapter.ts`

เมื่อ provider ล้มเหลว service เดิมยังให้ deterministic fallback โดยติดป้ายแยกชัด ไม่ควรอ้างเป็น live LLM success

ใน MVP fixture นี้ซ่อน Visual Canvas เดิมที่ยังมีผล optimization ตายตัว เพื่อไม่ให้ demo อ้างผลปรับปรุงที่ยังไม่ได้วัดซ้ำ หน้า fixture อื่นและงานเดิมยังคงอยู่

ทดสอบ CPE provider: `npm test -- src/lib/ai/__tests__/cpe.test.ts`

## Product Context

กรอก Product Goal, Brand Keywords, Theme Color (hex เช่น #2563EB), Target Audience และ Others ก่อน Run audit ช่องทั้งหมดเป็น optional
Context เป็น snapshot ของแต่ละ run ส่งให้ LLM พร้อมหลักฐาน เก็บใน Saved run และ Export JSON/Markdown หากแก้ Context แล้วต้องรัน audit ใหม่เพื่อใช้บริบทใหม่ การ Request Explanation ของ run เดิมจะใช้บริบทที่บันทึกกับ run นั้น
Context ช่วยปรับคำแนะนำ ไม่เปลี่ยนสูตร ค่า measurement เกณฑ์ หรือ status ของ deterministic checks ข้อมูลที่เป็นคำสั่งใน Context จะถูกจัดเป็น untrusted descriptive data
