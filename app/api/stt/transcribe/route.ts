import { DeepgramClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing DEEPGRAM_API_KEY" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const deepgram = new DeepgramClient({ apiKey } as any);
    const response = await (deepgram as any).listen.prerecorded.transcribeFile(buffer, {
      model: "nova-3-medical",
      smart_format: true,
      punctuate: true,
    });

    const channel = response.result?.results?.channels?.[0];
    const alt = channel?.alternatives?.[0];
    const transcript = alt?.transcript ?? "";
    const words = alt?.words ?? [];
    const confidence = alt?.confidence ?? 0;

    return NextResponse.json({ transcript, confidence, words });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
