"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import { updateStylistSchedule } from "@/server/actions/updateStylistSchedule";

export function StylistScheduleForm({
  stylistId,
  initialSlots,
}: {
  stylistId: string;
  initialSlots: string[];
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const save = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateStylistSchedule(stylistId, slots);
      if (result.ok) {
        setFeedback(`${result.count} 枠で保存しました`);
        router.refresh();
      } else {
        setFeedback(`保存失敗: ${result.reason}`);
      }
    });
  };

  return (
    <div className="space-y-4">
      <ScheduleEditor value={slots} onChange={setSlots} seedId={stylistId} />

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-md ring-1 ring-pomie-200">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn-primary disabled:opacity-60"
        >
          {pending ? "保存中..." : "スケジュールを保存"}
        </button>
        {feedback && <span className="text-xs text-ink-700">{feedback}</span>}
      </div>
    </div>
  );
}
