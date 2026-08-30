"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getMainTeamName, sortEmployees } from "@/lib/utils";

interface Question {
  id: string;
  text: string;
  description: string | null;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  questions: Question[];
}

interface Employee {
  id: string;
  name: string;
  nickname: string | null;
  employeeCode: string;
  position: string | null;
  departmentId: string;
  teamId: string | null;
  startDate?: string | null;
  department: { id: string; name: string; code?: string };
  team: { id: string; name: string; code?: string } | null;
}

interface EvaluationPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface EvaluatorAssignment {
  id: string;
  assignmentType: string;
  weightPercentage: number;
  category: Category | null;
  period: { id: string; name: string } | null;
  targetEmployee: { id: string; name: string; employeeCode: string } | null;
  targetDepartment: { id: string; name: string } | null;
  targetTeam: {
    id: string;
    name: string;
    code: string;
    department: { id: string; name: string; code: string };
  } | null;
}

interface EvaluationScoreInput {
  scoreValue: number;
  comment: string;
}

interface AssignmentSection {
  key: string;
  label: string;
  categoryId: string | null;
  categoryName: string;
  questions: Question[];
  weightPercentage: number;
  periodId: string | null;
  deptIds: Set<string>;
  empIds: Set<string>;
}

export default function MyEmployeesBatchEvaluationPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EvaluatorAssignment[]>([]);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);

  const [selectedTeam, setSelectedTeam] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("DEFAULT");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [evalStartDate, setEvalStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [evalEndDate, setEvalEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [batchScores, setBatchScores] = useState<
    Record<string, Record<string, Record<string, EvaluationScoreInput>>>
  >({});
  const [employeeComments, setEmployeeComments] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [empRes, assignRes, periodRes] = await Promise.all([
          fetch("/api/employees?status=active&limit=300"),
          fetch(`/api/evaluator-assignments?evaluatorUserId=${currentUserId}`),
          fetch("/api/evaluation-periods?status=ACTIVE"),
        ]);
        const [empData, assignData, periodData] = await Promise.all([
          empRes.json(),
          assignRes.json(),
          periodRes.json(),
        ]);
        if (empRes.ok) setEmployees(empData.data || []);
        if (assignRes.ok) setAssignments(assignData.data || []);
        if (periodRes.ok) {
          const pList: EvaluationPeriod[] = periodData.data || [];
          setPeriods(pList);
          if (pList.length > 0) setSelectedPeriodId(pList[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUserId]);

  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => { if (e.team) set.add(getMainTeamName(e.team)); });
    return Array.from(set).sort();
  }, [employees]);

  // Build assignment sections: group by (catId + mainTeam/dept)
  const assignmentSections = useMemo((): AssignmentSection[] => {
    const map = new Map<string, AssignmentSection>();
    for (const a of assignments) {
      const catId = a.category?.id ?? null;
      const catName = a.category?.name ?? "ไม่ระบุหมวดหมู่";
      const questions = a.category?.questions ?? [];

      if (a.assignmentType === "TEAM" && a.targetTeam) {
        const mainTeam = getMainTeamName(a.targetTeam);
        const deptId = a.targetTeam.department?.id;
        const key = `TEAM_${catId ?? "null"}_${mainTeam}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            label: `${mainTeam} — ${catName}`,
            categoryId: catId,
            categoryName: catName,
            questions,
            weightPercentage: a.weightPercentage,
            periodId: a.period?.id ?? null,
            deptIds: new Set(),
            empIds: new Set(),
          });
        }
        if (deptId) map.get(key)!.deptIds.add(deptId);
      } else if (a.assignmentType === "DEPARTMENT" && a.targetDepartment) {
        const deptId = a.targetDepartment.id;
        const key = `DEPT_${catId ?? "null"}_${deptId}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            label: `${a.targetDepartment.name} — ${catName}`,
            categoryId: catId,
            categoryName: catName,
            questions,
            weightPercentage: a.weightPercentage,
            periodId: a.period?.id ?? null,
            deptIds: new Set([deptId]),
            empIds: new Set(),
          });
        }
      } else if (a.assignmentType === "EMPLOYEE" && a.targetEmployee) {
        const key = `EMP_${catId ?? "null"}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            label: `รายบุคคล — ${catName}`,
            categoryId: catId,
            categoryName: catName,
            questions,
            weightPercentage: a.weightPercentage,
            periodId: a.period?.id ?? null,
            deptIds: new Set(),
            empIds: new Set(),
          });
        }
        map.get(key)!.empIds.add(a.targetEmployee.id);
      }
    }
    return Array.from(map.values());
  }, [assignments]);

  const getSectionEmployees = (section: AssignmentSection): Employee[] => {
    const raw = employees.filter((e) => {
      if (section.empIds.size > 0) return section.empIds.has(e.id);
      if (section.deptIds.size > 0) return section.deptIds.has(e.departmentId);
      return false;
    });
    const teamFiltered = selectedTeam === "ALL" ? raw : raw.filter((e) => {
      if (!e.team) return false;
      return getMainTeamName(e.team) === selectedTeam;
    });
    const searched = searchTerm
      ? teamFiltered.filter((e) => {
          const s = searchTerm.toLowerCase();
          return (
            e.name.toLowerCase().includes(s) ||
            (e.nickname?.toLowerCase().includes(s) ?? false) ||
            e.employeeCode.toLowerCase().includes(s) ||
            (e.position?.toLowerCase().includes(s) ?? false)
          );
        })
      : teamFiltered;
    return sortEmployees(searched, sortBy);
  };

  // Initialize default scores
  useEffect(() => {
    if (assignmentSections.length === 0 || employees.length === 0) return;
    setBatchScores((prev) => {
      const next = { ...prev };
      let changed = false;
      assignmentSections.forEach((section) => {
        if (!next[section.key]) { next[section.key] = {}; changed = true; }
        getSectionEmployees(section).forEach((emp) => {
          if (!next[section.key][emp.id]) { next[section.key][emp.id] = {}; changed = true; }
          section.questions.forEach((q) => {
            if (!next[section.key][emp.id][q.id]) {
              next[section.key][emp.id][q.id] = { scoreValue: 5, comment: "" };
              changed = true;
            }
          });
        });
      });
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentSections, employees, selectedTeam, searchTerm, sortBy]);

  const handleScoreChange = (sectionKey: string, employeeId: string, questionId: string, value: number) => {
    setBatchScores((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [employeeId]: {
          ...(prev[sectionKey]?.[employeeId] || {}),
          [questionId]: {
            scoreValue: value,
            comment: prev[sectionKey]?.[employeeId]?.[questionId]?.comment || "",
          },
        },
      },
    }));
  };

  const handleQuickFillSection = (sectionKey: string, sectionEmps: Employee[], questions: Question[], value: number) => {
    setBatchScores((prev) => {
      const next = { ...prev };
      if (!next[sectionKey]) next[sectionKey] = {};
      sectionEmps.forEach((emp) => {
        if (!next[sectionKey][emp.id]) next[sectionKey][emp.id] = {};
        questions.forEach((q) => {
          next[sectionKey][emp.id][q.id] = { scoreValue: value, comment: next[sectionKey][emp.id][q.id]?.comment || "" };
        });
      });
      return next;
    });
  };

  const handleQuickFillAll = (value: number) => {
    setBatchScores((prev) => {
      const next = { ...prev };
      assignmentSections.forEach((section) => {
        if (!next[section.key]) next[section.key] = {};
        getSectionEmployees(section).forEach((emp) => {
          if (!next[section.key][emp.id]) next[section.key][emp.id] = {};
          section.questions.forEach((q) => {
            next[section.key][emp.id][q.id] = { scoreValue: value, comment: next[section.key][emp.id][q.id]?.comment || "" };
          });
        });
      });
      return next;
    });
    setStatusMessage({ type: "success", text: `⚡ เติมคะแนน ${value} ดาว ให้พนักงานทุกส่วนแล้ว` });
  };

  const getEmployeeLiveScore = (sectionKey: string, employeeId: string, questions: Question[]) => {
    const scoresMap = batchScores[sectionKey]?.[employeeId];
    if (!scoresMap || questions.length === 0) return { pct: 100, grade: "A" };
    let total = 0; let count = 0;
    questions.forEach((q) => { const s = scoresMap[q.id]; if (s) { total += s.scoreValue; count++; } });
    if (count === 0) return { pct: 100, grade: "A" };
    const avg = total / count;
    const pct = Math.round(((avg - 1) / 4) * 100);
    let grade = "D";
    if (pct >= 85) grade = "A";
    else if (pct >= 75) grade = "B+";
    else if (pct >= 65) grade = "B";
    else if (pct >= 55) grade = "C";
    return { pct, grade };
  };

  const handleSubmitAll = async (isDraft = false) => {
    if (!selectedPeriodId) { setStatusMessage({ type: "error", text: "กรุณาเลือกรอบการประเมิน" }); return; }
    setSubmitting(true);
    setStatusMessage(null);
    try {
      const evaluationsPayload: any[] = [];
      const seen = new Set<string>();
      assignmentSections.forEach((section) => {
        getSectionEmployees(section).forEach((emp) => {
          if (seen.has(emp.id + section.key)) return;
          seen.add(emp.id + section.key);
          const empScores = batchScores[section.key]?.[emp.id] || {};
          const scoreArray = section.questions.map((q) => ({
            questionId: q.id,
            scoreValue: empScores[q.id]?.scoreValue || 5,
            comment: empScores[q.id]?.comment || null,
          }));
          if (scoreArray.length > 0) {
            evaluationsPayload.push({
              employeeId: emp.id,
              comment: employeeComments[emp.id] || null,
              scores: scoreArray,
            });
          }
        });
      });
      if (evaluationsPayload.length === 0) {
        setStatusMessage({ type: "error", text: "ไม่มีข้อมูลการประเมิน" });
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/evaluations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: selectedPeriodId, evalStartDate, evalEndDate, isDraft, evaluations: evaluationsPayload }),
      });
      const data = await res.json();
      if (!res.ok) { setStatusMessage({ type: "error", text: data.error || "เกิดข้อผิดพลาดในการบันทึก" }); return; }
      setStatusMessage({ type: "success", text: `🎉 บันทึกผลการประเมินพนักงาน ${data.count || evaluationsPayload.length} คน เรียบร้อยแล้ว!` });
    } catch {
      setStatusMessage({ type: "error", text: "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalAssignedEmps = useMemo(() => {
    const seen = new Set<string>();
    assignmentSections.forEach((s) => getSectionEmployees(s).forEach((e) => seen.add(e.id)));
    return seen.size;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentSections, employees, selectedTeam, searchTerm]);

  const sectionColors = [
    { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", badge: "bg-blue-500/15 border-blue-500/30 text-blue-300" },
    { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", badge: "bg-purple-500/15 border-purple-500/30 text-purple-300" },
    { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
    { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
    { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-400", badge: "bg-pink-500/15 border-pink-500/30 text-pink-300" },
    { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-400", badge: "bg-teal-500/15 border-teal-500/30 text-teal-300" },
  ];

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-card to-slate-900 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-lg font-black border border-primary/30">📋</span>
            แบบฟอร์มประเมินผลรวม (ตามสิทธิ์ที่มอบหมาย)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            แสดงเฉพาะพนักงานและหัวข้อประเมินที่ได้รับมอบหมายเท่านั้น — หัวข้อแต่ละส่วนกำหนดโดยระบบ
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400">⚡ เติมทุกส่วน:</span>
          {[5, 4, 3].map((v) => (
            <button key={v} type="button" onClick={() => handleQuickFillAll(v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${v === 5 ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20" : v === 4 ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"}`}>
              {"⭐".repeat(v)} {v} ดาว
            </button>
          ))}
        </div>
      </div>

      {/* Filters — no category dropdown */}
      <div className="bg-card p-5 rounded-2xl border border-border space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">👥 กรองทีม</label>
            <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm font-semibold focus:border-primary transition-colors">
              <option value="ALL">👥 ทุกทีม (All Teams)</option>
              {availableTeams.map((t) => <option key={t} value={t}>ทีม {t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">📅 รอบการประเมิน</label>
            <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm font-semibold focus:border-primary transition-colors">
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">ค้นหาพนักงาน</label>
            <input type="text" placeholder="ค้นหาชื่อ, ชื่อเล่น, รหัส..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">🔄 จัดเรียงพนักงาน</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm font-medium">
              <option value="DEFAULT">🏆 ค่าเริ่มต้น (ทีม &gt; ตำแหน่ง &gt; แผนก &gt; วัน)</option>
              <option value="NAME_ASC">👤 ชื่อพนักงาน (ก-ฮ)</option>
              <option value="CODE_ASC">🔢 รหัสพนักงาน (น้อย → มาก)</option>
              <option value="START_DATE_ASC">📅 วันเริ่มงาน (เก่า → ใหม่)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/60">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่เริ่มต้นประเมิน</label>
            <input type="date" value={evalStartDate} onChange={(e) => setEvalStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่สิ้นสุดประเมิน</label>
            <input type="date" value={evalEndDate} onChange={(e) => setEvalEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm font-mono" />
          </div>
        </div>
      </div>

      {/* Status */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between ${statusMessage.type === "success" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Sections */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-border">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          กำลังโหลดข้อมูลและสิทธิ์ที่มอบหมาย...
        </div>
      ) : assignmentSections.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-border">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-semibold">ยังไม่มีสิทธิ์การประเมินที่ถูกมอบหมาย</div>
          <div className="text-xs mt-1">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดสิทธิ์</div>
        </div>
      ) : (
        <div className="space-y-6">
          {assignmentSections.map((section, idx) => {
            const color = sectionColors[idx % sectionColors.length];
            const isCollapsed = collapsedSections.has(section.key);
            const sectionEmps = getSectionEmployees(section);
            const avgPct = sectionEmps.length > 0
              ? Math.round(sectionEmps.reduce((s, e) => s + getEmployeeLiveScore(section.key, e.id, section.questions).pct, 0) / sectionEmps.length)
              : 0;
            const weightPct = Number(section.weightPercentage);
            const actualScore = (weightPct / 100 * 15);
            const scoreLabel = actualScore % 1 === 0 ? actualScore.toFixed(0) : actualScore.toFixed(1);

            return (
              <div key={section.key} className={`rounded-2xl border ${color.border} overflow-hidden shadow-sm`}>
                {/* Section Header */}
                <div className={`${color.bg} px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black border ${color.border} ${color.bg} ${color.text} flex-shrink-0`}>
                      {section.empIds.size > 0 ? "👤" : "🏢"}
                    </div>
                    <div className="min-w-0">
                      <h2 className={`text-base font-extrabold ${color.text}`}>{section.label}</h2>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color.badge}`}>
                          👥 {sectionEmps.length} คน
                        </span>
                        <span className="text-xs text-slate-400">เฉลี่ย: <span className={`font-bold ${color.text}`}>{avgPct}%</span></span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color.badge}`}>
                          📝 {section.categoryName} ({section.questions.length} ข้อ)
                        </span>
                        <span className="text-xs text-slate-400">
                          น้ำหนัก: <span className="font-bold text-slate-300">{scoreLabel}/15 คะแนน ({weightPct.toFixed(1)}%)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-semibold">เติมส่วนนี้:</span>
                    {[5, 4, 3].map((v) => (
                      <button key={v} type="button"
                        onClick={() => handleQuickFillSection(section.key, sectionEmps, section.questions, v)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${v === 5 ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25" : v === 4 ? "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"}`}>
                        {"⭐".repeat(v)} {v}★
                      </button>
                    ))}
                    <button type="button" onClick={() => toggleSection(section.key)}
                      className="ml-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-border text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors">
                      {isCollapsed ? "▼ ขยาย" : "▲ ย่อ"}
                    </button>
                  </div>
                </div>

                {/* Questions preview (locked, cannot change) */}
                {!isCollapsed && section.questions.length > 0 && (
                  <div className="px-5 py-3 bg-slate-900/50 border-b border-border/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-primary">🔒 หัวข้อที่ประเมิน (กำหนดโดยระบบ):</span>
                      {section.questions.map((q, qIdx) => (
                        <span key={q.id} title={q.description || q.text}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-medium">
                          {qIdx + 1}. {q.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Table — grouped by department */}
                {!isCollapsed && (
                  sectionEmps.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      ไม่พบพนักงานในส่วนนี้ (อาจถูกกรองโดยทีมหรือคำค้นหา)
                    </div>
                  ) : (() => {
                    const deptMap = new Map<string, { id: string; name: string; emps: Employee[] }>();
                    sectionEmps.forEach((e) => {
                      const dId = e.department.id;
                      if (!deptMap.has(dId)) deptMap.set(dId, { id: dId, name: e.department.name, emps: [] });
                      deptMap.get(dId)!.emps.push(e);
                    });
                    const deptGroups = Array.from(deptMap.values()).sort((a, b) => a.name.localeCompare(b.name, "th"));

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-900/70 border-b border-border text-xs text-slate-400 font-bold uppercase tracking-wider">
                              <th className="py-3 px-4 w-10 text-center">#</th>
                              <th className="py-3 px-4 min-w-[200px]">พนักงาน</th>
                              <th className="py-3 px-3 min-w-[90px]">ทีม</th>
                              {section.questions.map((q, qIdx) => (
                                <th key={q.id} className="py-3 px-3 min-w-[160px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded bg-primary/20 text-primary text-[10px] flex items-center justify-center font-black">{qIdx + 1}</span>
                                    <span className="truncate max-w-[130px]" title={q.text}>{q.text}</span>
                                  </div>
                                </th>
                              ))}
                              <th className="py-3 px-3 min-w-[150px]">ความคิดเห็น</th>
                              <th className="py-3 px-4 w-24 text-center">คะแนนรวม</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 text-sm">
                            {deptGroups.map((dept, dIdx) => {
                              const deptAvgPct = dept.emps.length > 0
                                ? Math.round(dept.emps.reduce((s, e) => s + getEmployeeLiveScore(section.key, e.id, section.questions).pct, 0) / dept.emps.length)
                                : 0;
                              const totalCols = 3 + section.questions.length + 2;
                              return (
                                <>
                                  <tr key={`dept-hdr-${dept.id}-${dIdx}`} className={`${dIdx % 2 === 0 ? "bg-slate-800/60" : "bg-slate-800/40"} border-b border-t border-border/80`}>
                                    <td colSpan={totalCols} className="py-2.5 px-4">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                          <span className={`text-sm font-extrabold ${color.text}`}>🏢 {dept.name}</span>
                                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color.badge}`}>
                                            👥 {dept.emps.length} คน
                                          </span>
                                          <span className="text-xs text-slate-400">
                                            เฉลี่ย: <span className={`font-bold ${color.text}`}>{deptAvgPct}%</span>
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          <span className="text-[11px] text-slate-500">เติม:</span>
                                          {[5, 4, 3].map((v) => (
                                            <button key={v} type="button"
                                              onClick={() => handleQuickFillSection(section.key, dept.emps, section.questions, v)}
                                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold border transition-colors ${v === 5 ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25" : v === 4 ? "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"}`}>
                                              {Array(v).fill("⭐").join("")}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                  {dept.emps.map((emp, index) => {
                                    const live = getEmployeeLiveScore(section.key, emp.id, section.questions);
                                    const empScores = batchScores[section.key]?.[emp.id] || {};
                                    return (
                                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground">{index + 1}</td>
                                        <td className="py-3 px-4">
                                          <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 border ${color.border} ${color.bg} ${color.text}`}>
                                              {emp.nickname ? emp.nickname.slice(0, 2) : emp.name.slice(0, 2)}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5 flex-wrap">
                                                <span>{emp.name}</span>
                                                {emp.nickname && <span className="text-xs text-primary font-normal bg-primary/10 px-1.5 rounded">({emp.nickname})</span>}
                                              </div>
                                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <span className="font-mono text-[11px]">{emp.employeeCode}</span>
                                                {emp.position && <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{emp.position}</span>}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className={`text-[11px] font-bold ${color.text}`}>{getMainTeamName(emp.team)}</div>
                                        </td>
                                        {section.questions.map((q) => {
                                          const currentScore = empScores[q.id]?.scoreValue || 5;
                                          return (
                                            <td key={q.id} className="py-3 px-3">
                                              <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((val) => {
                                                  const isSelected = currentScore === val;
                                                  return (
                                                    <button key={val} type="button"
                                                      onClick={() => handleScoreChange(section.key, emp.id, q.id, val)}
                                                      className={`w-7 h-7 rounded-lg text-xs font-black transition-all flex items-center justify-center ${isSelected ? (val >= 4 ? "bg-green-500 text-white shadow-sm scale-105" : val === 3 ? "bg-amber-500 text-white shadow-sm scale-105" : "bg-red-500 text-white shadow-sm scale-105") : "bg-slate-900 border border-border text-slate-400 hover:border-primary/50 hover:text-foreground"}`}>
                                                      {val}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </td>
                                          );
                                        })}
                                        <td className="py-3 px-3">
                                          <input type="text" placeholder="ข้อเสนอแนะ..." value={employeeComments[emp.id] || ""}
                                            onChange={(e) => setEmployeeComments({ ...employeeComments, [emp.id]: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-xs" />
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${live.pct >= 80 ? "bg-green-500/10 text-green-400 border border-green-500/20" : live.pct >= 60 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                            {live.grade} ({live.pct}%)
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-border p-4 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">👥</span>
            <div>
              <div className="text-sm font-bold text-foreground">
                พร้อมประเมินพนักงาน {totalAssignedEmps} คน — {assignmentSections.length} ชุดสิทธิ์
              </div>
              <div className="text-xs text-muted-foreground">
                ทีม: {selectedTeam === "ALL" ? "ทุกทีม" : `ทีม ${selectedTeam}`} | รอบ: {periods.find(p => p.id === selectedPeriodId)?.name || "-"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={submitting} onClick={() => handleSubmitAll(true)}
              className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-bold transition-colors disabled:opacity-50">
              📝 บันทึกแบบร่าง (Draft)
            </button>
            <button type="button" disabled={submitting || totalAssignedEmps === 0} onClick={() => handleSubmitAll(false)}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50">
              {submitting
                ? (<><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />กำลังบันทึกผล...</>)
                : (<><span>💾</span> บันทึกผลการประเมินทุกคนพร้อมกัน ({totalAssignedEmps} คน)</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
