/**
 * Thai messages (the default language). DRAFT for the team to review: terms we are unsure of
 * go in docs/classroom/kit/glossary.md with a `ตรวจสอบ` mark.
 *
 * This file defines the SHAPE of the catalogue; `en.ts` must match it exactly, so a message
 * missing in one language is a type error, not a blank on screen.
 */
export const th = {
  language: {
    label: "ภาษา",
    th: "ไทย",
    en: "English",
    switchTo: "เปลี่ยนเป็นภาษาอังกฤษ",
  },
  shell: {
    homeLabel: "LUNARIS หน้าแรก",
    tagline: "เปรียบเทียบจุดลงจอดบริเวณขั้วใต้ของดวงจันทร์ ด้วยแสงอาทิตย์ การติดต่อกับโลก และภูมิประเทศ",
    modulesLabel: "เมนูหลัก",
    scopeHeading: "ขอบเขต",
    scopeNote: "เครื่องมือวางแผนและวิจัยเบื้องต้น ไม่ใช่ระบบรับรองการลงจอดของยานอวกาศ",
  },
  nav: {
    learn: {
      title: "เรียนรู้",
      shortTitle: "เรียนรู้",
      description: "บทเรียนหกคาบ: ข้างขึ้นข้างแรม ขั้วใต้ของดวงจันทร์ และการเลือกจุดลงจอด",
    },
    overview: {
      title: "ภาพรวม",
      shortTitle: "ภาพรวม",
      description: "ลูกโลกดวงจันทร์และภูมิประเทศขั้วใต้ จุดลงจอดที่เป็นตัวเลือก เส้นเวลา และสถานะระบบ",
    },
    illumination: {
      title: "แสงอาทิตย์และโลก",
      shortTitle: "ดวงอาทิตย์/โลก",
      description: "ตำแหน่งของดวงอาทิตย์และโลก แสงสว่าง และแนวสายตาตรงถึงโลกของแต่ละจุด",
    },
    terrain: {
      title: "ภูมิประเทศ",
      shortTitle: "ภูมิประเทศ",
      description: "ความสูง ความลาดชัน ความขรุขระ และขอบฟ้าของแต่ละจุด (ข้อมูล LOLA)",
    },
    compare: {
      title: "เปรียบเทียบ",
      shortTitle: "เปรียบเทียบ",
      description: "เปรียบเทียบจุดลงจอดเคียงข้างกัน ทุกค่าเปิดดูหลักฐานได้",
    },
    data: {
      title: "แหล่งข้อมูล",
      shortTitle: "ข้อมูล",
      description: "ทะเบียนชุดข้อมูล ที่มา และสถานะการจัดหา",
    },
    about: {
      title: "เกี่ยวกับ",
      shortTitle: "เกี่ยวกับ",
      description: "LUNARIS คืออะไร ใครใช้ สร้างอย่างไร และคำศัพท์",
    },
  },
};

/** Every leaf is a string, or a function returning a string for messages with values in them. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof th>;
