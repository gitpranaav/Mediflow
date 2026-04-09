"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { useEMRExtraction } from "@/src/hooks/useEMRExtraction";

export function ExtractButton({
  consultationId,
  transcriptText,
  onExtracted,
}: {
  consultationId: string;
  transcriptText: string;
  onExtracted: (data: any) => void;
}) {
  const { extract, status } = useEMRExtraction();

  return (
    <Button
      loading={status === "extracting"}
      onClick={async () => {
        const data = await extract({ consultation_id: consultationId, transcript_text: transcriptText });
        if (data) onExtracted(data);
      }}
      iconLeft={<Sparkles className="h-4 w-4" />}
    >
      {status === "extracting" ? "AI is analyzing the transcript..." : "Extract from Transcript"}
    </Button>
  );
}
