import { ArrowLeft, ArrowRight } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Button } from "@/components/ui/button";
import { MoonViewport } from "@/components/viewport/moon-viewport";

/**
 * THROWAWAY mock of one lesson step for the K-12 sample review. Not a real route: the lesson
 * route belongs to S-CLASSROOM. Remove this file before the PR is merged.
 */
export default function DesignSampleLessonStep() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <p className="text-2xs font-medium text-muted-foreground">คาบที่ 2 · ขั้นที่ 3 จาก 5</p>
      <h1 className="text-3xl font-semibold leading-tight text-foreground">
        ดวงจันทร์ข้างขึ้นข้างแรมเกิดจากอะไร
      </h1>
      <div className="space-y-3 text-base text-foreground">
        <p>
          ดวงจันทร์ไม่ได้เปล่งแสงเอง เราเห็นดวงจันทร์เพราะแสงจากดวงอาทิตย์ตกกระทบพื้นผิวแล้วสะท้อนมาที่โลก
          ดวงจันทร์ครึ่งหนึ่งสว่างอยู่เสมอ
        </p>
        <p>
          สิ่งที่เปลี่ยนไปคือมุมที่เรามองจากโลก ลองลากเวลาไปข้างหน้า
          แล้วสังเกตว่าส่วนสว่างที่เรามองเห็นเปลี่ยนไปอย่างไร
        </p>
      </div>

      <div className="h-[22rem] overflow-hidden rounded-xl border border-border-strong shadow-sm">
        <MoonViewport />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-panel p-5">
        <div>
          <p className="text-2xs text-muted-foreground">ส่วนที่สว่างของดวงจันทร์ที่เห็นจากโลก</p>
          <p className="numeric font-mono text-4xl font-semibold text-foreground">52 %</p>
        </div>
        <EvidenceBadge kind="calculation" />
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" size="default">
          <ArrowLeft /> ย้อนกลับ
        </Button>
        <Button size="default">
          ถัดไป <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
