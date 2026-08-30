"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getMainTeamName } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  description: string | null;
  questions: {
    id: string;
    text: string;
    description: string | null;
    sortOrder: number;
  }[];
}

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  department: { name: string };
  team: { name: string } | null;
  position: string | null;
}

interface EvaluationPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  expectedWorkingDays: number;
}

interface ScoreScaleLabel {
  scoreValue: number;
  label: string;
  description: string | null;
}

export default function NewEvaluationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmployeeId = searchParams.get("employeeId") || "";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scoreLabels, setScoreLabels] = useState<ScoreScaleLabel[]>([
    { scoreValue: 1, label: "ต้องปรับปรุงมาก", description: "ต่ำกว่ามาตรฐานมาก" },
    { scoreValue: 2, label: "ต้องปรับปรุง", description: "ต่ำกว่ามาตรฐาน" },
    { scoreValue: 3, label: "ผ่านมาตรฐาน", description: "อยู่ในเกณฑ์มาตรฐาน" },
    { scoreValue: 4, label: "ดี", description: "สูงกว่ามาตรฐาน" },
    { scoreValue: 5, label: "ดีมาก", description: "ดีเยี่ยม" },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Form states
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [evalStartDate, setEvalStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [evalEndDate, setEvalEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [workingDays, setWorkingDays] = useState(1);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { value: number; comment: string }>>({});
  const [overallComment, setOverallComment] = useState("");

  // Fetch init data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [empRes, periodRes, catRes, scaleRes] = await Promise.all([
          fetch("/api/employees?status=active"),
          fetch("/api/evaluation-periods?status=ACTIVE"),
          fetch("/api/evaluation-categories"),
          fetch("/api/score-scales"),
        ]);

        const [empData, periodData, catData, scaleData] = await Promise.all([
          empRes.json(),
          periodRes.json(),
          catRes.json(),
          scaleRes.json(),
        ]);

        if (empRes.ok) setEmployees(empData.data || []);
        if (periodRes.ok) {
          const pList = periodData.data || [];
          setPeriods(pList);
          if (pList.length > 0) setSelectedPeriodId(pList[0].id);
        }
        if (catRes.ok) {
          const catList: Category[] = catData.data || [];
          setCategories(catList);

          // Pre-initialize scores default to 3 (standard)
          const initialScores: Record<string, { value: number; comment: string }> = {};
          for (const c of catList) {
            for (const q of c.questions) {
              initialScores[q.id] = { value: 3, comment: "" };
            }
          }
          setScores(initialScores);
        }

        if (scaleRes.ok && scaleData.data?.length > 0) {
          const defaultScale = scaleData.data.find((s: any) => s.isDefault) || scaleData.data[0];
          if (defaultScale?.labels?.length > 0) {
            setScoreLabels(defaultScale.labels);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-detect Category when employee changes
  useEffect(() => {
    if (!selectedEmployeeId || categories.length === 0) return;

    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) return;

    const pos = (emp.position || "").toLowerCase();
    const dept = (emp.department?.name || "").toLowerCase();

    // Check if employee is Head, SupHead, Supervisor, Transfer, HRD
    const isHeadLevel =
      pos.includes("head") ||
      pos.includes("sup") ||
      pos.includes("lead") ||
      pos.includes("manager") ||
      dept.includes("head") ||
      dept.includes("hrd");

    if (isHeadLevel) {
      const headCat = categories.find((c) => c.name.toLowerCase().includes("head") || c.name.toLowerCase().includes("suphead"));
      if (headCat) setSelectedCategoryId(headCat.id);
    } else {
      const staffCat = categories.find((c) => c.name.toLowerCase().includes("พนักงาน") || c.name.toLowerCase().includes("staff"));
      if (staffCat) setSelectedCategoryId(staffCat.id);
    }
  }, [selectedEmployeeId, categories, employees]);

  // Real-time check overlap and working days when date or employee changes
  useEffect(() => {
    if (!selectedPeriodId || !selectedEmployeeId || !evalStartDate || !evalEndDate) return;

    const checkOverlap = async () => {
      try {
        const res = await fetch("/api/evaluations/check-overlap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodId: selectedPeriodId,
            employeeId: selectedEmployeeId,
            evalStartDate,
            evalEndDate,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setWorkingDays(data.workingDaysCount);
          if (data.hasOverlap) {
            setOverlapWarning(`⚠️ พบการประเมินซ้ำในวันที่: ${data.overlappingDays.join(", ")}`);
          } else {
            setOverlapWarning(null);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    checkOverlap();
  }, [selectedPeriodId, selectedEmployeeId, evalStartDate, evalEndDate]);

  const handleScoreChange = (questionId: string, value: number) => {
    setScores((prev) => ({
      ...prev,
      [questionId]: {
        value,
        comment: prev[questionId]?.comment || "",
      },
    }));
  };

  const handleQuestionCommentChange = (questionId: string, comment: string) => {
    setScores((prev) => ({
      ...prev,
      [questionId]: {
        value: prev[questionId]?.value || 3,
        comment,
      },
    }));
  };

  // Active categories to display and submit
  const activeCategories = useMemo(() => {
    if (selectedCategoryId === "ALL") return categories;
    return categories.filter((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const handleSave = async (isDraft = false) => {
    setSubmitting(true);
    setFormError("");

    if (!selectedPeriodId) {
      setFormError("กรุณาเลือกรอบการประเมิน");
      setSubmitting(false);
      return;
    }
    if (!selectedEmployeeId) {
      setFormError("กรุณาเลือกพนักงานที่ต้องการประเมิน");
      setSubmitting(false);
      return;
    }
    if (!evalStartDate || !evalEndDate) {
      setFormError("กรุณาระบุช่วงวันที่ประเมิน");
      setSubmitting(false);
      return;
    }

    // Only submit questions from the active displayed categories
    const activeQuestionIds = new Set<string>();
    activeCategories.forEach((c) => c.questions.forEach((q) => activeQuestionIds.add(q.id)));

    const scorePayload = Object.entries(scores)
      .filter(([questionId]) => activeQuestionIds.has(questionId))
      .map(([questionId, s]) => ({
        questionId,
        scoreValue: s.value,
        comment: s.comment || null,
      }));

    if (scorePayload.length === 0) {
      setFormError("กรุณาให้คะแนนคำถามในแบบฟอร์ม");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: selectedPeriodId,
          employeeId: selectedEmployeeId,
          evalStartDate,
          evalEndDate,
          comment: overallComment || null,
          scores: scorePayload,
          isDraft,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "เกิดข้อผิดพลาดในการบันทึก");
        return;
      }

      router.push("/evaluations");
    } catch {
      setFormError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">กำลังโหลดแบบฟอร์มการประเมิน...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/evaluations" className="hover:text-foreground">การประเมิน</Link>
            <span>/</span>
            <span className="text-foreground font-medium">บันทึกผลการปฏิบัติงาน</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">แบบประเมินผลการปฏิบัติงานรายวัน</h1>
        </div>
      </div>

      {formError && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
          {formError}
        </div>
      )}

      {/* Step 1: Employee & Period & Date Range Selection */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">1</span>
          ข้อมูลการประเมินและช่วงวันที่
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">รอบการประเมิน *</label>
            <select
              required
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm font-medium"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">เลือกพนักงานที่ต้องการประเมิน *</label>
            <select
              required
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm font-medium"
            >
              <option value="">-- กรุณาเลือกพนักงาน --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeCode}) {emp.position ? `[${emp.position}]` : ""} {emp.team ? `- ${getMainTeamName(emp.team)}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Employee Info Box */}
        {selectedEmployee && (
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold text-xl flex items-center justify-center">
              {selectedEmployee.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-foreground">{selectedEmployee.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                รหัส: <span className="font-mono text-primary font-semibold">{selectedEmployee.employeeCode}</span> • แผนก: {selectedEmployee.department.name}
                {selectedEmployee.team && ` • ทีม: ${getMainTeamName(selectedEmployee.team)}`}
                {selectedEmployee.position && ` • ตำแหน่ง: ${selectedEmployee.position}`}
              </div>
            </div>
          </div>
        )}

        {/* Date Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <label className="block text-sm font-medium mb-1">ตั้งแต่วันที่ *</label>
            <input
              type="date"
              required
              value={evalStartDate}
              onChange={(e) => setEvalStartDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ถึงวันที่ *</label>
            <input
              type="date"
              required
              value={evalEndDate}
              onChange={(e) => setEvalEndDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Working days counter and warning */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl border text-xs" style={{ background: "rgba(59, 130, 246, 0.1)", borderColor: "rgba(59, 130, 246, 0.25)" }}>
          <span className="font-medium" style={{ color: "#93c5fd" }}>
            ช่วงวันที่เลือก: <span className="font-bold text-sm" style={{ color: "#60a5fa" }}>{workingDays} วัน</span> (นับทุกวันที่เลือก)
          </span>
          {overlapWarning && (
            <span className="text-amber-300 font-bold px-2 py-1 rounded" style={{ background: "rgba(245, 158, 11, 0.2)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              {overlapWarning}
            </span>
          )}
        </div>
      </div>

      {/* Step 2: Evaluation Scoring Form & Category Selector */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">2</span>
              หัวข้อและคะแนนการประเมิน
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              เลือกหัวข้อที่ตรงกับตำแหน่งของผู้ถูกประเมิน (เกณฑ์คะแนน: 1 = น้อยที่สุด, 5 = ดีเยี่ยม)
            </p>
          </div>

          {/* Category Tabs Selector */}
          <div className="flex items-center gap-1.5 flex-wrap bg-muted/40 p-1 rounded-xl border border-border">
            {categories.map((c) => {
              const isSelected = selectedCategoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {c.name.includes("Head") ? "👔 " : "👥 "}
                  {c.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedCategoryId("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategoryId === "ALL"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              🌐 ทุกหัวข้อ
            </button>
          </div>
        </div>

        {activeCategories.map((cat) => (
          <div key={cat.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="bg-muted/40 px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <span>{cat.name.includes("Head") ? "👔" : "👥"}</span>
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                )}
              </div>
              <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-lg">
                {cat.questions.length} คำถาม
              </span>
            </div>

            <div className="p-6 divide-y divide-border space-y-6">
              {cat.questions.map((q, qIndex) => {
                const currentScore = scores[q.id]?.value || 3;
                const currentComment = scores[q.id]?.comment || "";

                return (
                  <div key={q.id} className={qIndex > 0 ? "pt-6" : ""}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="max-w-md">
                        <div className="font-medium text-sm text-foreground flex items-center gap-2">
                          <span className="font-mono text-xs text-primary font-bold">#{qIndex + 1}</span>
                          {q.text}
                        </div>
                        {q.description && (
                          <p className="text-xs text-muted-foreground mt-1">{q.description}</p>
                        )}
                      </div>

                      {/* Score selector buttons 1..5 */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((val) => {
                            const isSelected = currentScore === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleScoreChange(q.id, val)}
                                className={`score-btn ${isSelected ? "selected" : ""}`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-xs text-primary font-medium">
                          {scoreLabels.find((l) => l.scoreValue === currentScore)?.label || ""}
                        </span>
                      </div>
                    </div>

                    {/* Question Comment Box */}
                    <div className="mt-3">
                      <input
                        type="text"
                        placeholder="หมายเหตุหรือความคิดเห็นเพิ่มเติมสำหรับข้อนี้ (ไม่บังคับ)..."
                        value={currentComment}
                        onChange={(e) => handleQuestionCommentChange(q.id, e.target.value)}
                        className="w-full px-3 py-1.5 bg-background border border-input rounded-lg text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Step 3: Overall Comment & Actions */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">3</span>
          ความคิดเห็นและข้อเสนอแนะโดยรวม
        </h2>
        <textarea
          rows={3}
          placeholder="กรอกข้อเสนอแนะ การชื่นชม หรือสิ่งที่พนักงานควรพัฒนา..."
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm"
        />

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-border">
          <Link
            href="/evaluations"
            className="w-full sm:w-auto px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted text-center"
          >
            ยกเลิก
          </Link>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(true)}
            className="w-full sm:w-auto px-5 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-xl text-sm font-medium transition-colors"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกเป็นฉบับร่าง (Draft)"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(false)}
            className="w-full sm:w-auto px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 shadow-md transition-colors"
          >
            {submitting ? "กำลังส่งผล..." : "ส่งผลการประเมิน (Submit)"}
          </button>
        </div>
      </div>
    </div>
  );
}
