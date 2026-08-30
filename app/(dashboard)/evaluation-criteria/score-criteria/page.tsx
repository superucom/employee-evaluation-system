"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EVALUATION_WEIGHT_PRESETS } from "@/lib/calculations/evaluation-weights";

interface ScoreScaleLabel {
  id: string;
  scoreValue: number;
  label: string;
  description: string | null;
}

interface ScoreScale {
  id: string;
  name: string;
  minScore: number;
  maxScore: number;
  isActive: boolean;
  isDefault: boolean;
  labels: ScoreScaleLabel[];
}

export default function ScoreCriteriaPage() {
  const [scales, setScales] = useState<ScoreScale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScales = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/score-scales");
      const data = await res.json();
      if (res.ok) setScales(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScales();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3 text-sm font-medium">
        <Link href="/evaluation-criteria/categories" className="text-muted-foreground hover:text-foreground px-2">
          หมวดหมู่การประเมิน
        </Link>
        <Link href="/evaluation-criteria/questions" className="text-muted-foreground hover:text-foreground px-2">
          คำถามการประเมิน
        </Link>
        <Link href="/evaluation-criteria/score-criteria" className="text-primary border-b-2 border-primary pb-3 -mb-3 px-2">
          เกณฑ์คะแนน & สัดส่วนประเมิน
        </Link>
        <Link href="/evaluation-criteria/grades" className="text-muted-foreground hover:text-foreground px-2">
          เกณฑ์เกรด (Grades)
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">เกณฑ์คะแนนและสัดส่วนการประเมิน</h1>
        <p className="text-sm text-muted-foreground mt-1">
          กำหนดระดับคะแนนแบบประเมินรายวัน และตารางสัดส่วนค่าน้ำหนักการประเมินดุลพินิจในแต่ละเดือน (คะแนนเต็ม 15)
        </p>
      </div>

      {/* Section 1: สัดส่วนการประเมินดุลพินิจในแต่ละเดือน (คะแนนเต็ม 15) */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>📊</span>
              สัดส่วนการประเมินดุลพินิจในแต่ละเดือน (คะแนนเต็ม 15)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              โครงสร้างการแบ่งสัดส่วนคะแนนตามตำแหน่งของผู้ถูกประเมินและผู้ประเมิน
            </p>
          </div>
          <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full self-start sm:self-auto">
            คะแนนเต็ม 15
          </span>
        </div>

        {/* Table of Weight Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 bg-slate-900/80 text-slate-300 font-bold uppercase w-32">ผู้ประเมิน</th>
                {EVALUATION_WEIGHT_PRESETS.map((preset) => (
                  <th
                    key={preset.key}
                    className="p-3 text-center font-bold text-foreground"
                    style={{
                      background:
                        preset.key === "H_TF_HRD"
                          ? "rgba(59, 130, 246, 0.25)"
                          : preset.key === "QC"
                          ? "rgba(168, 85, 247, 0.25)"
                          : preset.key === "SH_STF"
                          ? "rgba(34, 197, 94, 0.25)"
                          : preset.key === "SP"
                          ? "rgba(236, 72, 153, 0.25)"
                          : preset.key === "STAFF"
                          ? "rgba(20, 184, 166, 0.25)"
                          : "rgba(245, 158, 11, 0.25)",
                      borderRight: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="text-sm font-extrabold">{preset.targetGroup}</div>
                    <div className="text-[10px] text-slate-300 font-normal mt-0.5">{preset.description}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Super */}
              <tr className="hover:bg-muted/30">
                <td className="p-3 font-bold text-slate-300 bg-slate-900/40">Super</td>
                <td className="p-3 text-center font-bold text-blue-400">10 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 2)</span></td>
                <td className="p-3 text-center font-bold text-purple-400">5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 1)</span></td>
                <td className="p-3 text-center font-bold text-emerald-400">5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 1)</span></td>
                <td className="p-3 text-center font-bold text-pink-400">5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 1)</span></td>
                <td className="p-3 text-center font-bold text-teal-400">5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 1)</span></td>
                <td className="p-3 text-center font-bold text-amber-400">5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 1)</span></td>
              </tr>
              {/* S.Sup */}
              <tr className="hover:bg-muted/30">
                <td className="p-3 font-bold text-slate-300 bg-slate-900/40">S.Sup</td>
                <td className="p-3 text-center font-bold text-blue-400">5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 1)</span></td>
                <td className="p-3 text-center font-bold text-purple-400">2.5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 0.5)</span></td>
                <td className="p-3 text-center font-bold text-emerald-400">2.5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 0.5)</span></td>
                <td className="p-3 text-center font-bold text-pink-400">2.5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 0.5)</span></td>
                <td className="p-3 text-center font-bold text-teal-400">2.5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 0.5)</span></td>
                <td className="p-3 text-center font-bold text-amber-400">2.5 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 0.5)</span></td>
              </tr>
              {/* Head / Transfer / HRD */}
              <tr className="hover:bg-muted/30">
                <td className="p-3 font-bold text-slate-300 bg-slate-900/40">Head / HRD / TF</td>
                <td className="p-3 text-center text-slate-500 font-mono">-</td>
                <td className="p-3 text-center font-bold text-purple-400">7.5 <span className="text-[10px] text-slate-400 font-normal">(HRD)</span></td>
                <td className="p-3 text-center font-bold text-emerald-400">7.5 <span className="text-[10px] text-slate-400 font-normal">(Head/TF)</span></td>
                <td className="p-3 text-center font-bold text-pink-400">7.5 <span className="text-[10px] text-slate-400 font-normal">(Head)</span></td>
                <td className="p-3 text-center font-bold text-teal-400">6.25 <span className="text-[10px] text-slate-400 font-normal">(Head)</span></td>
                <td className="p-3 text-center font-bold text-amber-400">7.5 <span className="text-[10px] text-slate-400 font-normal">(Head)</span></td>
              </tr>
              {/* SH (Sub Head) */}
              <tr className="hover:bg-muted/30">
                <td className="p-3 font-bold text-slate-300 bg-slate-900/40">SH (Sub Head)</td>
                <td className="p-3 text-center text-slate-500 font-mono">-</td>
                <td className="p-3 text-center text-slate-500 font-mono">-</td>
                <td className="p-3 text-center text-slate-500 font-mono">-</td>
                <td className="p-3 text-center text-slate-500 font-mono">-</td>
                <td className="p-3 text-center font-bold text-teal-400">1.25 <span className="text-[10px] text-slate-400 font-normal">(อัตราส่วน 0.25)</span></td>
                <td className="p-3 text-center text-slate-500 font-mono">-</td>
              </tr>
              {/* Total Row */}
              <tr className="bg-slate-900/80 border-t-2 border-primary/40 font-extrabold">
                <td className="p-3 text-primary uppercase">รวมคะแนนเต็ม</td>
                <td className="p-3 text-center text-primary text-sm">15 คะแนน</td>
                <td className="p-3 text-center text-primary text-sm">15 คะแนน</td>
                <td className="p-3 text-center text-primary text-sm">15 คะแนน</td>
                <td className="p-3 text-center text-primary text-sm">15 คะแนน</td>
                <td className="p-3 text-center text-primary text-sm">15 คะแนน</td>
                <td className="p-3 text-center text-primary text-sm">15 คะแนน</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Score Scale (1-5) */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">เกณฑ์คะแนนแบบประเมินรายวัน (Score Scale 1-5)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ความหมายและคำอธิบายของคะแนน 1 ถึง 5 สำหรับคำถามแต่ละข้อ
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูลเกณฑ์คะแนน...</div>
        ) : (
          <div className="space-y-6">
            {scales.map((scale) => (
              <div key={scale.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">{scale.name}</h3>
                      {scale.isDefault && (
                        <span className="text-xs bg-green-500/10 text-green-400 font-semibold px-2 py-0.5 rounded border border-green-500/20">
                          ค่าเริ่มต้นของระบบ (Default)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ช่วงคะแนน: {scale.minScore} ถึง {scale.maxScore} คะแนน
                    </p>
                  </div>
                </div>

                {/* Labels Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {scale.labels?.map((label) => (
                    <div
                      key={label.id}
                      className="p-4 rounded-xl border border-border bg-slate-900/60 text-center space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto shadow-md">
                        {label.scoreValue}
                      </div>
                      <div className="font-bold text-sm text-foreground">{label.label}</div>
                      {label.description && (
                        <p className="text-xs text-muted-foreground">{label.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
