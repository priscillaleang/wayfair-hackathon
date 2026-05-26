import { NextRequest, NextResponse } from "next/server";
import {
  generateInspectionScript,
  fallbackScriptGen,
  type CandidateQuestion,
} from "@/lib/subconscious-script";

export async function POST(req: NextRequest) {
  const { sku, productName, candidatePool } = (await req.json()) as {
    sku: string;
    productName: string;
    candidatePool: CandidateQuestion[];
  };

  try {
    const ranked = await generateInspectionScript(sku, productName, candidatePool);
    return NextResponse.json({ ranked, source: "subconscious" });
  } catch {
    const ranked = fallbackScriptGen(candidatePool);
    return NextResponse.json({ ranked, source: "fallback" });
  }
}
