# Project Metrics Reference — ProofUI Audit

> **เอกสารรวบรวม Metrics และเกณฑ์การวัดผลทั้งหมดในระบบ ProofUI Audit**  
> ครอบคลุมทั้งเกณฑ์การวัดตามมาตรฐาน WCAG 2.2, การคำนวณสี, ค่าสถิติการตรวจประเมิน (Audit Run Summary), ตัวชี้วัดการเปรียบเทียบการแก้ไข (Iteration Delta), และเกณฑ์การทดสอบระบบ (Quality Gates).  
> 🌐 **Language**: ภาษาไทย | [English Version](METRICS.en.md)

---

## 📑 สารบัญ
1. [WCAG 2.2 Audit Measurement Metrics (เกณฑ์การวัดผลตามกฎ 5 ข้อ)](#1-wcag-22-audit-measurement-metrics)
   - [1.1 Text Contrast (SC 1.4.3)](#11-text-contrast-wcag-22-sc-143)
   - [1.2 Non-Text Contrast (SC 1.4.11)](#12-non-text-contrast-wcag-22-sc-1411)
   - [1.3 Target Size (SC 2.5.8)](#13-target-size-wcag-22-sc-258)
   - [1.4 Reflow (SC 1.4.10)](#14-reflow-wcag-22-sc-1410)
   - [1.5 Text Spacing (SC 1.4.12)](#15-text-spacing-wcag-22-sc-1412)
2. [Color Math & Luminance Calculations (สูตรการคำนวณแสงและสี)](#2-color-math--luminance-calculations)
3. [Audit Run & Dashboard Aggregation Metrics (เมตริกสรุปผลการตรวจ)](#3-audit-run--dashboard-aggregation-metrics)
4. [Iteration & Optimization Delta Metrics (เมตริกการเปรียบเทียบผลการแก้)](#4-iteration--optimization-delta-metrics)
5. [Standard Audit Viewports (ขนาดหน้าจอมาตรฐานในการตรวจ)](#5-standard-audit-viewports)
6. [Quality & Verification Metrics (เมตริกการทดสอบและคุณภาพระบบ)](#6-quality--verification-metrics)
7. [Traceability & File Mapping (ตารางเชื่อมโยงไฟล์โค้ด)](#7-traceability--file-mapping)

---

## 1. WCAG 2.2 Audit Measurement Metrics

ทุกประเด็นที่ระบบตรวจพบจะบันทึกค่าที่วัดได้จริง (`measured`) เทียบกับเกณฑ์มาตรฐานขั้นต่ำ (`expected`) โดยมีรายละเอียดของแต่ละกฎดังนี้:

### 1.1 Text Contrast (WCAG 2.2 SC 1.4.3)
ตรวจสอบความเปรียบต่างของสีข้อความเทียบกับพื้นหลัง

| เมตริก (Metric Key) | ชนิดข้อมูล | คำอธิบายและเกณฑ์การวัด |
|---|---|---|
| `contrastRatio` | `number` | อัตราส่วนคอนทราสต์ที่คำนวณได้สำหรับการแสดงผล (ปัดเศษลง 2 ตำแหน่ง เพื่อไม่ให้ 4.496 ปัดเป็น 4.50 หลอกตา) |
| `rawRatio` | `number` | ค่าอัตราส่วนความแม่นยำเต็ม (Floating-point) ใช้สำหรับตัดสินสถานะ `pass` หรือ `candidateFail` ทางคณิตศาสตร์ |
| `fontSizePx` | `number` | ขนาดตัวอักษรเป็น CSS พิกเซล |
| `fontWeight` | `number` | น้ำหนักตัวอักษรแบบตัวเลข (Normalized: `bold`/`bolder` = 700, `normal` = 400) |
| `isLargeText` | `boolean` | ตัวอักษรขนาดใหญ่หรือไม่ โดยถือเป็น Large Text เมื่อ:<br>• `fontSizePx` $\ge 24\text{px}$ (ที่น้ำหนักปกติ)<br>• `fontSizePx` $\ge 18.66\text{px}$ และ `fontWeight` $\ge 700$ (ตัวหนา) |
| `hasComplexBackground` | `boolean` | ตรวจพบภาพพื้นหลัง Gradient, Image, SVG, Video หรือ Canvas (จะติดสถานะ `needsReview`) |
| `hasAncestorGroupOpacity`| `boolean` | มีบรรพบุรุษที่มีค่า CSS `opacity < 1` ทำให้ค่าสีเพี้ยนจากการคำนวณแบบระนาบเดียว |

#### เกณฑ์ขั้นต่ำ (Thresholds):
- **Normal Text**: คอนทราสต์ขั้นต่ำอย่างน้อย **4.5:1**
- **Large Text**: คอนทราสต์ขั้นต่ำอย่างน้อย **3.0:1**
- **Priority Heuristics**: 
  - `P1`: Normal text คอนทราสต์ต่ำรุนแรง ($< 3.0:1$)
  - `P2`: คอนทราสต์ต่ำปานกลาง ($3.0:1$ ถึง $4.49:1$)
  - `P3`: ผ่านเกณฑ์ หรือต้องให้มนุษย์รีวิว (`needsReview`)

---

### 1.2 Non-Text Contrast (WCAG 2.2 SC 1.4.11)
ตรวจสอบคอนทราสต์ของส่วนควบคุม UI (เช่น ขอบปุ่ม, ช่องกรอกข้อมูล) และชิ้นส่วนกราฟิกที่มีความหมาย

| เมตริก (Metric Key) | ชนิดข้อมูล | คำอธิบายและเกณฑ์การวัด |
|---|---|---|
| `contrastRatio` | `number` | อัตราส่วนความเปรียบต่างระหว่างตัวบ่งชี้ (`indicatorColor`) กับพื้นผิวที่ติดกัน (`adjacentColor`) |
| `componentType` | `enum` | ประเภทองค์ประกอบ: `ui-component-border`, `ui-component-fill`, `graphical-object`, `focus-indicator` |
| `isInactiveOrDisabled` | `boolean` | สถานะปิดใช้งาน/Disable (ข้อยกเว้นตาม SC 1.4.11 ถือว่าผ่านการตรวจ) |
| `isDecorativeOrLogo` | `boolean` | รูปภาพตกแต่งหรือโลโก้แบรนด์ (ข้อยกเว้นตาม SC 1.4.11) |
| `isStateMeaningUncertain`| `boolean` | ระบบไม่สามารถฟันธงได้ว่ากราฟิกนี้จำเป็นต่อการระบุสถานะหรือไม่ (ติด `needsReview`) |

#### เกณฑ์ขั้นต่ำ (Thresholds):
- **UI Components & Meaningful Graphics**: คอนทราสต์ขั้นต่ำอย่างน้อย **3.0:1**
- **Priority Heuristics**:
  - `P1`: คอนทราสต์ต่ำรุนแรง ($< 2.0:1$)
  - `P2`: คอนทราสต์ต่ำปานกลาง ($2.0:1$ ถึง $2.99:1$)
  - `P3`: ผ่านเกณฑ์ หรือเป็นข้อยกเว้น

---

### 1.3 Target Size (WCAG 2.2 SC 2.5.8)
ตรวจสอบขนาดพื้นที่สัมผัสของปุ่ม, ลิงก์, และ Interactive Controls

| เมตริก (Metric Key) | ชนิดข้อมูล | คำอธิบายและเกณฑ์การวัด |
|---|---|---|
| `width` / `height` | `number` | ขนาดความกว้างและความสูงจริงของ Element Bounding Box (CSS px) |
| `TARGET_SIZE_THRESHOLD` | `24` | ขนาดขั้นต่ำตามมาตรฐาน: **$24 \times 24\text{ CSS px}$** |
| `SPACING_CIRCLE_DIAMETER` | `24` | เส้นผ่านศูนย์กลางวงกลมสำหรับทดสอบระยะห่าง ($24\text{px}$) |
| `SPACING_CIRCLE_RADIUS` | `12` | รัศมีวงกลมจากจุดกึ่งกลางของ Target ($12\text{px}$) |
| `hasSufficientSpacing` | `boolean` | ผ่านข้อยกเว้น Spacing Alternative หรือไม่ (วงกลมขนาดเส้นผ่านศูนย์กลาง 24px รอบกึ่งกลางปุ่ม ไม่ทับปุ่มอื่น และระยะห่างจุดกึ่งกลางระหว่าง 2 ปุ่มเล็กไม่น้อยกว่า 24px) |
| `isInline` | `boolean` | เป็นลิงก์ในประโยคข้อความ (Inline Link Exception ติด `needsReview`) |
| `hasEquivalentTarget` | `boolean` | มีปุ่มควบคุมที่ทำหน้าที่เหมือนกันบนหน้าเดียวกันที่ขนาดถึงเกณฑ์ |

#### เกณฑ์ขั้นต่ำ (Thresholds):
- **ขนาดขั้นต่ำ**: **$24 \times 24\text{ CSS px}$**
- **Priority Heuristics**:
  - `P1`: ขนาดเล็กวิกฤต ($< 18\text{px}$ ทั้งกว้างหรือสูง เสี่ยงต่อการกดพลาดสูงมาก)
  - `P2`: ขนาดต่ำกว่าเกณฑ์ปานกลาง ($18\text{px}$ ถึง $23.9\text{px}$)
  - `P3`: ขนาดถึงเกณฑ์ หรือเข้าข่ายข้อยกเว้น

---

### 1.4 Reflow (WCAG 2.2 SC 1.4.10)
ตรวจสอบความสามารถในการจัดหน้าจอใหม่โดยไม่เกิดการเลื่อน 2 มิติ (2D Scroll) ที่ความกว้าง **$320\text{ CSS px}$**

| เมตริก (Metric Key) | ชนิดข้อมูล | คำอธิบายและเกณฑ์การวัด |
|---|---|---|
| `scrollWidth` | `number` | ความกว้างของเนื้อหาทั้งหมดในหน้าเว็บ (px) |
| `clientWidth` | `number` | ความกว้างของพื้นที่หน้าจอที่แสดงผลจริง (ที่หน้าจอนี้คือ $320\text{px}$) |
| `horizontalOverflowPx` | `number` | ระยะล้นแนวนอน คำนวณจาก $\max(0, \text{scrollWidth} - \text{clientWidth})$ |
| `HORIZONTAL_OVERFLOW_TOLERANCE_PX` | `1.0` | ค่าความคลาดเคลื่อน Subpixel (ถ้าล้นไม่เกิน $1.0\text{px}$ จะไม่นับว่าล้น) |
| `clipDeficitPx` | `number` | จำนวนพิกเซลที่เนื้อหาหรือปุ่มถูกตัดขาดจาก `overflow: hidden` หรือหลุดออกนอกจอ $320\text{px}$ |
| `isEssential2D` | `boolean` | เป็นองค์ประกอบ 2 มิติที่จำเป็น (เช่น Data Table, แผนที่, แผนภูมิ ติดสถานะ `needsReview`) |

#### เกณฑ์ขั้นต่ำ (Thresholds):
- **ระยะล้นแนวนอนสูงสุดที่ยอมรับได้**: $\le 1.0\text{ CSS px}$
- **Priority Heuristics**:
  - `P1`: ล้นรุนแรง ($> 50\text{px}$), มีข้อความถูกตัดขาดทิ้ง, หรือปุ่มแอ็กชันหลุดลอยออกนอกจอ
  - `P2`: ล้นปานกลาง ($\le 50\text{px}$), หรือมีแถบ Nested Horizontal Scroll Strip
  - `P3`: เลย์เอาต์จัดคอลัมน์เดียวสมบูรณ์ หรือเป็นตารางข้อมูล 2D ที่จำเป็น

---

### 1.5 Text Spacing (WCAG 2.2 SC 1.4.12)
ตรวจสอบว่าเนื้อหาไม่ถูกตัดทับ (Clip) หรือซ้อนทับกัน (Overlap) เมื่อถูกฉีดสไตล์ขยายระยะห่างตัวอักษร

#### ค่าตัวแปรที่นำมาทดสอบฉีดเข้าสู่ระบบ (WCAG Injected Ratios):
- **Line height**: อย่างน้อย **$1.5 \times \text{fontSize}$**
- **Letter spacing**: อย่างน้อย **$0.12 \times \text{fontSize}$**
- **Word spacing**: อย่างน้อย **$0.16 \times \text{fontSize}$**
- **Paragraph margin-bottom**: อย่างน้อย **$2.0 \times \text{fontSize}$**
*(ระบบมี Minimum-Preserving Rule: หากสไตล์เดิมของเว็บตั้งไว้กว้างกว่านี้ จะต้องไม่ถูกลดทอนลง)*

#### เมตริกการวัดความเสียหาย (Deficit Measurements):
| เมตริก (Metric Key) | ชนิดข้อมูล | คำอธิบายและเกณฑ์การวัด |
|---|---|---|
| `verticalClipDeficit` | `number` | $\max(0, \text{scrollHeight} - \text{clientHeight})$ ระยะข้อความล้นลงล่างแล้วถูกตัดหาย |
| `horizontalClipDeficit`| `number` | $\max(0, \text{scrollWidth} - \text{clientWidth})$ ระยะข้อความล้นออกขวาแล้วถูกตัดหาย |
| `isControlObscured` | `boolean` | ข้อความขยายตัวจนเลื่อนลงมา**บดบังปุ่มกดหรือคอนโทรลอื่น** |
| `isNewDocumentOverflow`| `boolean` | การขยายตัวหนังสือทำให้เกิด horizontal scroll ระดับหน้าเว็บ |
| `isBoundingBoxEscaped` | `boolean` | ข้อความทะลุกรอบขอบเขตภาชนะออกมาภายนอก |
| `hasTextOverlap` | `boolean` | ตัวหนังสือขยายชนหรือทับซ้อนกับกล่องข้อความข้างเคียง |

#### Priority Heuristics:
- `P0 (Critical)`: ข้อความขยายทับปุ่ม Interactive Control จนกดไม่ได้
- `P1 (High)`: เกิด Document Scroll ใหม่, ข้อความถูกตัดแนวนอน, หรือถูกตัดแนวตั้ง $> 15\text{px}$
- `P2 (Medium)`: ถูกตัดแนวตั้ง $\le 15\text{px}$, หรือข้อความทะลุกรอบ Bounding Box
- `P3 (Low)`: ข้อความยืดขยายได้อย่างราบรื่น หรือเกิดการแตะกันของ badge ที่ต้องตรวจสอบสายตา

---

## 2. Color Math & Luminance Calculations

ไฟล์อ้างอิง: [`color-math.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/audit/color-math.ts)

### 2.1 Relative Luminance ($L$)
คำนวณตามมาตรฐาน WCAG 2.2 จากค่าสี sRGB ($R, G, B \in [0, 255]$):

1. **แปลงค่าสีให้อยู่ในช่วง $[0, 1]$**:
   $$C_{\text{srgb}} = \frac{C}{255}$$
2. **แปลงเป็น Linear RGB**:
   $$C_{\text{linear}} = \begin{cases} \frac{C_{\text{srgb}}}{12.92} & \text{ถ้า } C_{\text{srgb}} \le 0.04045 \\ \left(\frac{C_{\text{srgb}} + 0.055}{1.055}\right)^{2.4} & \text{ถ้า } C_{\text{srgb}} > 0.04045 \end{cases}$$
3. **คำนวณ Relative Luminance**:
   $$L = 0.2126 \times R_{\text{linear}} + 0.7152 \times G_{\text{linear}} + 0.0722 \times B_{\text{linear}}$$

### 2.2 Contrast Ratio
คำนวณเปรียบเทียบระหว่างความสว่างที่มากกว่า ($L_1$) และความสว่างที่น้อยกว่า ($L_2$):
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
*(ค่า $+0.05$ ชดเชยแสงสะท้อนของจอภาพ Ambient Flare)*

### 2.3 Alpha Compositing & Layer Blending
คำนวณการซ้อนทับของสีโปร่งแสง (Alpha Blending):
$$\alpha_{\text{out}} = \alpha_{\text{src}} + \alpha_{\text{dst}} \times (1 - \alpha_{\text{src}})$$
$$C_{\text{out}} = \frac{C_{\text{src}} \times \alpha_{\text{src}} + C_{\text{dst}} \times \alpha_{\text{dst}} \times (1 - \alpha_{\text{src}})}{\alpha_{\text{out}}}$$

---

## 3. Audit Run & Dashboard Aggregation Metrics

กำหนดใน [`ux-issue.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/schema/ux-issue.ts) และ [`report-schema.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/report/report-schema.ts):

| เมตริก (Metric Key) | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `totalRawFindings` (`rawFindingCount`) | `integer` | จำนวนผลตรวจดิบทั้งหมดจากทุกองค์ประกอบข้าม 3 viewports |
| `totalGroupedIssues` (`groupedIssueCount`) | `integer` | จำนวนการ์ดปัญหาหลังยุบรวม Selector เดียวกันด้วย Fingerprint |
| `passCount` | `integer` | จำนวนการตรวจที่ผ่านเกณฑ์มาตรฐาน |
| `candidateFailCount` | `integer` | จำนวนการตรวจที่พบหลักฐานว่าไม่ผ่านเกณฑ์ |
| `needsReviewCount` | `integer` | จำนวนการตรวจที่ไม่สามารถฟันธงได้ด้วยระบบอัตโนมัติ ต้องให้มนุษย์ตัดสิน |
| `priorityCounts.P0` | `integer` | จำนวนประเด็นระดับ Critical (ฟังก์ชันการทำงานใช้งานไม่ได้) |
| `priorityCounts.P1` | `integer` | จำนวนประเด็นระดับ High (การละเมิดรุนแรง เสี่ยงต่อผู้ใช้สูง) |
| `priorityCounts.P2` | `integer` | จำนวนประเด็นระดับ Medium (การละเมิดปานกลาง) |
| `priorityCounts.P3` | `integer` | จำนวนประเด็นระดับ Low / Pass / ข้อยกเว้นที่ต้องรีวิว |

---

## 4. Iteration & Optimization Delta Metrics

กำหนดใน [`iteration.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/schema/iteration.ts):

| เมตริก (Metric Key) | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `baselineMeasurement` | `object` | ค่าที่วัดได้ก่อนการแก้ไข (เช่น `{ width: 16, height: 16 }`) |
| `candidateMeasurement`| `object` | ค่าที่วัดได้หลังฉีด CSS Override ใน Sandbox (เช่น `{ width: 24, height: 24 }`) |
| `measurementDelta` | `object` | ผลต่างระหว่าง Before และ After (เช่น `{ deltaWidth: +8, deltaHeight: +8 }`) |
| `regressionResult` | `enum` | การประเมินผลกระทบหลังแก้ไข:<br>• **`improved`**: แก้ไขสำเร็จ ค่าดีขึ้นและผ่านเกณฑ์<br>• **`unchanged`**: ค่าเท่าเดิม การแก้ไขไม่มีผล<br>• **`regressed`**: แย่ลง เกิดผลกระทบข้างเคียงต่อส่วนอื่น<br>• **`unable_to_verify`**: ไม่สามารถยืนยันผลลัพธ์ได้ |

---

## 5. Standard Audit Viewports

กำหนดใน [`browser.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/audit/browser.ts):

| Viewport Name | กว้าง $\times$ สูง (CSS px) | วัตถุประสงค์ในการตรวจ |
|---|:---:|---|
| **Small / Reflow** | **$320 \times 667$** | ตรวจสอบ SC 1.4.10 Reflow (จำลองการซูม 400% บนจอ 1280px) และหน้าจอมือถือขนาดเล็ก |
| **Mobile Baseline** | **$375 \times 667$** | ตัวแทนหน้าจอมือถือมาตรฐาน (iPhone SE / Standard Mobile) |
| **Desktop Baseline** | **$1440 \times 900$** | ตัวแทนหน้าจอเดสก์ท็อปและแล็ปท็อปมาตรฐาน |

---

## 6. Quality & Verification Metrics

ระบุไว้ใน [`RELEASE_NOTES.md`](file:///Users/mysteriouz/Projects/proof-ui-audit/RELEASE_NOTES.md):

| หมวดหมู่การทดสอบ | ผลลัพธ์ที่ได้ | สถานะ |
|---|:---:|:---:|
| **Traceability Requirements** | 131 / 131 ข้อ | **100% Verified** |
| **Prohibited Features Scan** | 20 / 20 รายการ | **100% Absent** (ปลอดโค้ดตกแต่งที่ไม่จำเป็น) |
| **Vitest Unit Tests** | 175 / 175 passed | **100% Pass** (Hermetic / ทำงานแบบออฟไลน์) |
| **Playwright E2E Tests** | 31 / 31 passed | **100% Pass** (ทดสอบทั้งกระบวนการใช้งาน) |
| **Total Automated Tests** | **206 / 206 passed** | **100% Pass** |
| **TypeScript Strict Check** | 0 errors | **Clean** |
| **ESLint 9 Flat Config** | 0 warnings / 0 errors | **Clean** |
| **Next.js Production Routes** | 9 / 9 routes compiled | **Clean** |

---

## 7. Traceability & File Mapping

| กฎ / โมดูล | ไฟล์การคำนวณและกฎ | ไฟล์ทดสอบ Unit Test |
|---|---|---|
| **Text Contrast** | [`text-contrast.ts`](src/lib/audit/rules/text-contrast.ts) | [`text-contrast.test.ts`](src/lib/audit/rules/__tests__/text-contrast.test.ts) |
| **Non-Text Contrast**| [`non-text-contrast.ts`](src/lib/audit/rules/non-text-contrast.ts) | [`non-text-contrast.test.ts`](src/lib/audit/rules/__tests__/non-text-contrast.test.ts) |
| **Target Size** | [`target-size.ts`](src/lib/audit/rules/target-size.ts) | [`target-size.test.ts`](src/lib/audit/rules/__tests__/target-size.test.ts) |
| **Reflow** | [`reflow.ts`](src/lib/audit/rules/reflow.ts) | [`reflow.test.ts`](src/lib/audit/rules/__tests__/reflow.test.ts) |
| **Text Spacing** | [`text-spacing.ts`](src/lib/audit/rules/text-spacing.ts) | [`text-spacing.test.ts`](src/lib/audit/rules/__tests__/text-spacing.test.ts) |
| **Color Math** | [`color-math.ts`](src/lib/audit/color-math.ts) | [`color-math.test.ts`](src/lib/audit/__tests__/color-math.test.ts) |
| **Grouping Engine** | [`grouping.ts`](src/lib/audit/grouping.ts) | [`grouping.test.ts`](src/lib/audit/__tests__/grouping.test.ts) |
| **Iteration Sandbox**| [`isolated-preview.ts`](src/lib/iteration/isolated-preview.ts) | [`iteration.test.ts`](src/lib/iteration/__tests__/iteration.test.ts) |
| **Report Schemas** | [`report-schema.ts`](src/lib/report/report-schema.ts) | [`report-export.test.ts`](src/lib/report/__tests__/report-export.test.ts) |
