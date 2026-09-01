import * as XLSX from "xlsx";

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const val = row[header] === null || row[header] === undefined ? "" : String(row[header]);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(data: Record<string, any>[], filename: string, sheetName = "Report") {
  if (data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Helper to get interpretation label (แปลผล)
 */
function getScoreInterpretation(score: number): string {
  if (score >= 4.5) return "ดีเยี่ยม";
  if (score >= 3.5) return "ดี";
  if (score >= 2.5) return "ผ่านเกณฑ์";
  if (score > 0) return "ต้องปรับปรุง";
  return "บกพร่อง";
}

/**
 * Export structured Excel matching organizational format:
 * แปลผลคะแนนประเมิน [TEAM] ประจำเดือน [MONTH]
 * - Section 1: แบบประเมินพนักงาน Head
 * - Section 2: แบบประเมินพนักงาน Staff
 */
export function exportMonthlyEvaluationExcel({
  periodName,
  teamOrDeptName = "ทั้งหมด",
  records = [],
  filename,
}: {
  periodName: string;
  teamOrDeptName?: string;
  records: any[];
  filename?: string;
}) {
  // 1. Group records by Employee
  const employeeMap = new Map<string, {
    employee: any;
    evaluations: any[];
  }>();

  for (const r of records) {
    const empId = r.employee.id;
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        employee: r.employee,
        evaluations: [],
      });
    }
    employeeMap.get(empId)!.evaluations.push(r);
  }

  // Separate employees into Head group, QA group, and Staff group
  const headEmployees: any[] = [];
  const qaEmployees: any[] = [];
  const staffEmployees: any[] = [];

  employeeMap.forEach(({ employee, evaluations }) => {
    const pos = (employee.position || "").toLowerCase();
    const dept = (employee.department?.name || "").toLowerCase();
    const deptCode = (employee.department?.code || "").toUpperCase();

    const isHead =
      pos.includes("head") ||
      pos.includes("sup") ||
      pos.includes("lead") ||
      pos.includes("manager") ||
      pos.includes("hrd") ||
      pos.includes("transfer") ||
      pos.includes("tranfer") ||
      dept.includes("head") ||
      dept.includes("hrd");

    const isQA = !isHead && (deptCode === "QA" || dept.includes("qa") || pos.includes("qa"));

    const item = { employee, evaluations };
    if (isHead) {
      headEmployees.push(item);
    } else if (isQA) {
      qaEmployees.push(item);
    } else {
      staffEmployees.push(item);
    }
  });

  const getDepartmentRank = (deptOrPos: string): number => {
    const d = (deptOrPos || "").toLowerCase();
    if (d.includes("withdraw") || d.includes("wd") || d.includes("tranfer") || d.includes("transfer")) {
      return 1;
    }
    if (d === "cr" || /\bcr\b/i.test(d) || d.includes("head cr")) {
      return 3;
    }
    return 2;
  };

  const compareExportEmployees = (a: { employee: any }, b: { employee: any }) => {
    const deptA = a.employee.position || (a.employee.team?.name ? `${a.employee.department?.name} / ${a.employee.team?.name}` : a.employee.department?.name) || "-";
    const deptB = b.employee.position || (b.employee.team?.name ? `${b.employee.department?.name} / ${b.employee.team?.name}` : b.employee.department?.name) || "-";
    const rankA = getDepartmentRank(deptA);
    const rankB = getDepartmentRank(deptB);
    if (rankA !== rankB) return rankA - rankB;
    const deptComp = deptA.localeCompare(deptB, "th");
    if (deptComp !== 0) return deptComp;
    return (a.employee.name || "").localeCompare(b.employee.name || "", "th");
  };

  // Sort by department (WD top, middle depts, CR bottom) and then employee name
  headEmployees.sort(compareExportEmployees);
  staffEmployees.sort(compareExportEmployees);
  qaEmployees.sort((a, b) => (a.employee.name || "").localeCompare(b.employee.name || "", "th"));

  // Build 2D rows for SheetJS
  const wsData: any[][] = [];
  const merges: XLSX.Range[] = [];

  // Helper to extract formatted feedback from all evaluations for an employee
  const getEmployeeFeedback = (evaluations: any[]): string => {
    const feedbacks: string[] = [];
    const seenComments = new Set<string>();

    for (const ev of evaluations) {
      const evaluatorName = ev.evaluatorUser?.fullName || ev.evaluatorUser?.username || "ผู้ประเมิน";

      // Overall evaluation comment
      if (ev.comment && typeof ev.comment === "string" && ev.comment.trim()) {
        const trimmed = ev.comment.trim();
        const key = `${evaluatorName}:${trimmed}`;
        if (!seenComments.has(key)) {
          seenComments.add(key);
          feedbacks.push(`[${evaluatorName}]: ${trimmed}`);
        }
      }

      // Individual score comments if any
      if (ev.scores && Array.isArray(ev.scores)) {
        ev.scores.forEach((s: any, idx: number) => {
          if (s.comment && typeof s.comment === "string" && s.comment.trim()) {
            const trimmed = s.comment.trim();
            const key = `${evaluatorName}:Q${idx + 1}:${trimmed}`;
            if (!seenComments.has(key) && trimmed !== ev.comment?.trim()) {
              seenComments.add(key);
              feedbacks.push(`[${evaluatorName} ข้อ ${idx + 1}]: ${trimmed}`);
            }
          }
        });
      }
    }

    return feedbacks.length > 0 ? feedbacks.join(" | ") : "-";
  };

  // Row 1: Title Banner (Team / Dept)
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 22 } });
  wsData.push([`แปลผลคะแนนประเมิน ${teamOrDeptName}`]);

  // Row 2: Month / Period
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 22 } });
  wsData.push([`ประจำเดือน ${periodName}`]);

  // Row 3: Blank separator
  wsData.push([]);

  // =========================================================
  // SECTION 1: แบบประเมินพนักงาน Head
  // =========================================================
  const headHeaderRow = wsData.length;
  merges.push(
    { s: { r: headHeaderRow, c: 0 }, e: { r: headHeaderRow, c: 3 } },
    { s: { r: headHeaderRow, c: 4 }, e: { r: headHeaderRow, c: 7 } },
    { s: { r: headHeaderRow, c: 8 }, e: { r: headHeaderRow, c: 11 } },
    { s: { r: headHeaderRow, c: 12 }, e: { r: headHeaderRow, c: 15 } },
    { s: { r: headHeaderRow, c: 16 }, e: { r: headHeaderRow, c: 22 } }
  );
  wsData.push([
    "แบบประเมินพนักงาน Head", "", "", "",
    "1. การทำงานร่วมกับทีม/ประสานงาน (มนุษยสัมพันธ์ , มีการประสานงานร่วมกับทีม , ทักษะด้านอารมณ์)", "", "", "",
    "2. ความสามารถในการตัดสินใจ (ทักษะการแก้ปัญหา,ภาวะผู้นำ,กล้าตัดสินใจ)", "", "", "",
    "3. มีความยุติธรรม (ซื่อสัตย์ต่อหน้าที่ที่ตนรับผิดชอบ,ไม่เลือกปฏิบัติ)", "", "", "",
    "ข้อเสนอแนะ / ความคิดเห็นเพิ่มเติม", "", "", "", "", "", "",
  ]);

  const headSubHeaderRow = wsData.length;
  merges.push({ s: { r: headSubHeaderRow, c: 16 }, e: { r: headSubHeaderRow, c: 22 } });
  wsData.push([
    "No.", "Name", "", "Department",
    "Super", "S.Sup", "Total", "แปลผล",
    "Super", "S.Sup", "Total", "แปลผล",
    "Super", "S.Sup", "Total", "แปลผล",
    "ข้อเสนอแนะ (ผู้ประเมิน -> ข้อความ)", "", "", "", "", "", "",
  ]);

  const getEvaluatorRoleType = (username: string, fullName: string): string => {
    const u = (username || "").toLowerCase();
    const f = (fullName || "").toLowerCase();

    if (u.includes("shead") || f.includes("support head") || f.includes("support.h") || f.includes("sup_head")) {
      return "shead";
    }
    if (u.includes("ssuper") || f.includes("supportsuper") || f.includes("support super")) {
      return "ssuper";
    }
    if (u.includes("super") || f.includes("super")) {
      return "super";
    }
    if (u.includes("head") || f.includes("head")) {
      return "head";
    }
    return "other";
  };

  const getQuestionScore = (evaluations: any[], qIndex: number, roleKeyword: string) => {
    const matchingScores: number[] = [];
    for (const ev of evaluations) {
      const username = ev.evaluatorUser?.username || "";
      const fullName = ev.evaluatorUser?.fullName || "";
      const roleType = getEvaluatorRoleType(username, fullName);

      if (roleType === roleKeyword.toLowerCase() && ev.scores && ev.scores.length > qIndex) {
        matchingScores.push(Number(ev.scores[qIndex]?.scoreValue || 0));
      }
    }
    if (matchingScores.length === 0) return "";
    return Math.round((matchingScores.reduce((a, b) => a + b, 0) / matchingScores.length) * 10) / 10;
  };

  const DEPTS_WITH_SHEAD = new Set(["CC", "CCAD", "CS", "MKT", "WITHDRAW"]);

  const getStaffWeights = (code: string) => {
    if (DEPTS_WITH_SHEAD.has((code || "").toUpperCase())) {
      return { super: 5, ssuper: 2.5, head: 6.25, shead: 1.25 };
    }
    return { super: 5, ssuper: 2.5, head: 7.5, shead: 0 };
  };

  const calcWeightedTotal = (
    scores: { super?: any; ssuper?: any; head?: any; shead?: any },
    weights: { super: number; ssuper: number; head?: number; shead?: number }
  ) => {
    let totalWeighted = 0;
    let totalWeight = 0;

    const s = typeof scores.super === "number" ? scores.super : null;
    const ss = typeof scores.ssuper === "number" ? scores.ssuper : null;
    const h = typeof scores.head === "number" ? scores.head : null;
    const sh = typeof scores.shead === "number" ? scores.shead : null;

    if (s !== null) {
      totalWeighted += s * weights.super;
      totalWeight += weights.super;
    }
    if (ss !== null) {
      totalWeighted += ss * weights.ssuper;
      totalWeight += weights.ssuper;
    }
    if (weights.head && h !== null) {
      totalWeighted += h * weights.head;
      totalWeight += weights.head;
    }
    if (weights.shead && sh !== null) {
      totalWeighted += sh * weights.shead;
      totalWeight += weights.shead;
    }

    if (totalWeight === 0) return 0;
    return Math.round((totalWeighted / totalWeight) * 10) / 10;
  };

  headEmployees.forEach((item, index) => {
    const { employee, evaluations } = item;
    const nameParts = employee.name.split(" ");
    const firstName = nameParts[0] || employee.name;
    const nickname = employee.nickname || (nameParts.length > 1 ? nameParts[1] : "");
    const deptDisplay = employee.position || employee.department?.name || "-";
    const headWeights = { super: 10, ssuper: 5 };

    const q1Super = getQuestionScore(evaluations, 0, "super");
    const q1SSuper = getQuestionScore(evaluations, 0, "ssuper");
    const q1Total = calcWeightedTotal({ super: q1Super, ssuper: q1SSuper }, headWeights);
    const q1Interpretation = getScoreInterpretation(q1Total);

    const q2Super = getQuestionScore(evaluations, 1, "super");
    const q2SSuper = getQuestionScore(evaluations, 1, "ssuper");
    const q2Total = calcWeightedTotal({ super: q2Super, ssuper: q2SSuper }, headWeights);
    const q2Interpretation = getScoreInterpretation(q2Total);

    const q3Super = getQuestionScore(evaluations, 2, "super");
    const q3SSuper = getQuestionScore(evaluations, 2, "ssuper");
    const q3Total = calcWeightedTotal({ super: q3Super, ssuper: q3SSuper }, headWeights);
    const q3Interpretation = getScoreInterpretation(q3Total);

    const feedbackText = getEmployeeFeedback(evaluations);

    const currentRow = wsData.length;
    merges.push({ s: { r: currentRow, c: 16 }, e: { r: currentRow, c: 22 } });

    wsData.push([
      index + 1,
      firstName,
      nickname,
      deptDisplay,
      q1Super, q1SSuper, q1Total, q1Interpretation,
      q2Super, q2SSuper, q2Total, q2Interpretation,
      q3Super, q3SSuper, q3Total, q3Interpretation,
      feedbackText,
    ]);
  });

  if (headEmployees.length === 0) {
    const emptyRow = wsData.length;
    merges.push({ s: { r: emptyRow, c: 16 }, e: { r: emptyRow, c: 22 } });
    wsData.push([1, "ไม่มีข้อมูลพนักงานระดับ Head", "", "-", "", "", 0, "บกพร่อง", "", "", 0, "บกพร่อง", "", "", 0, "บกพร่อง", "-"]);
  }

  // Separator
  wsData.push([]);

  // =========================================================
  // SECTION 2: แบบประเมินพนักงาน Staff
  // =========================================================
  const staffHeaderRow = wsData.length;
  merges.push(
    { s: { r: staffHeaderRow, c: 0 }, e: { r: staffHeaderRow, c: 3 } },
    { s: { r: staffHeaderRow, c: 4 }, e: { r: staffHeaderRow, c: 9 } },
    { s: { r: staffHeaderRow, c: 10 }, e: { r: staffHeaderRow, c: 15 } },
    { s: { r: staffHeaderRow, c: 16 }, e: { r: staffHeaderRow, c: 21 } },
    { s: { r: staffHeaderRow, c: 22 }, e: { r: staffHeaderRow, c: 22 } }
  );
  wsData.push([
    "แบบประเมินพนักงาน Staff", "", "", "",
    "1. การทำงานร่วมกับทีม/ประสานงาน (มนุษยสัมพันธ์ , มีการประสานงานร่วมกับทีม , ทักษะด้านอารมณ์)", "", "", "", "", "",
    "2. ความรับผิดชอบต่อหน้างาน (ความรับผิดชอบ, ตรงต่อเวลา, การส่งมอบงาน)", "", "", "", "", "",
    "3. ความรู้ความสามารถเกี่ยวกับหน้างาน (ทักษะเฉพาะทาง, ความถูกต้องแม่นยำ)", "", "", "", "", "",
    "ข้อเสนอแนะ / ความคิดเห็นเพิ่มเติม",
  ]);

  wsData.push([
    "No.", "Name", "", "Department",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "ข้อเสนอแนะ (ผู้ประเมิน -> ข้อความ)",
  ]);

  staffEmployees.forEach((item, index) => {
    const { employee, evaluations } = item;
    const nameParts = employee.name.split(" ");
    const firstName = nameParts[0] || employee.name;
    const nickname = employee.nickname || (nameParts.length > 1 ? nameParts[1] : "");
    const deptDisplay = employee.position || (employee.team?.name ? `${employee.department?.name} / ${employee.team?.name}` : employee.department?.name) || "-";
    const deptCode = employee.department?.code || "";
    const staffWeights = getStaffWeights(deptCode);

    const q1Super = getQuestionScore(evaluations, 0, "super");
    const q1SSuper = getQuestionScore(evaluations, 0, "ssuper");
    const q1Head = getQuestionScore(evaluations, 0, "head");
    const q1SHead = getQuestionScore(evaluations, 0, "shead");
    const q1Total = calcWeightedTotal({ super: q1Super, ssuper: q1SSuper, head: q1Head, shead: q1SHead }, staffWeights);
    const q1Interpretation = getScoreInterpretation(q1Total);

    const q2Super = getQuestionScore(evaluations, 1, "super");
    const q2SSuper = getQuestionScore(evaluations, 1, "ssuper");
    const q2Head = getQuestionScore(evaluations, 1, "head");
    const q2SHead = getQuestionScore(evaluations, 1, "shead");
    const q2Total = calcWeightedTotal({ super: q2Super, ssuper: q2SSuper, head: q2Head, shead: q2SHead }, staffWeights);
    const q2Interpretation = getScoreInterpretation(q2Total);

    const q3Super = getQuestionScore(evaluations, 2, "super");
    const q3SSuper = getQuestionScore(evaluations, 2, "ssuper");
    const q3Head = getQuestionScore(evaluations, 2, "head");
    const q3SHead = getQuestionScore(evaluations, 2, "shead");
    const q3Total = calcWeightedTotal({ super: q3Super, ssuper: q3SSuper, head: q3Head, shead: q3SHead }, staffWeights);
    const q3Interpretation = getScoreInterpretation(q3Total);

    const feedbackText = getEmployeeFeedback(evaluations);

    wsData.push([
      index + 1,
      firstName,
      nickname,
      deptDisplay,
      q1Super, q1SSuper, q1Head, q1SHead, q1Total, q1Interpretation,
      q2Super, q2SSuper, q2Head, q2SHead, q2Total, q2Interpretation,
      q3Super, q3SSuper, q3Head, q3SHead, q3Total, q3Interpretation,
      feedbackText,
    ]);
  });

  if (staffEmployees.length === 0) {
    wsData.push([1, "ไม่มีข้อมูลพนักงานทั่วไป", "", "-", "", "", "", "", 0, "บกพร่อง", "", "", "", "", 0, "บกพร่อง", "", "", "", "", 0, "บกพร่อง", "-"]);
  }

  // Separator
  wsData.push([]);

  // =========================================================
  // SECTION 3: แบบประเมินพนักงาน QA
  // =========================================================
  const qaHeaderRow = wsData.length;
  merges.push(
    { s: { r: qaHeaderRow, c: 0 }, e: { r: qaHeaderRow, c: 3 } },
    { s: { r: qaHeaderRow, c: 4 }, e: { r: qaHeaderRow, c: 9 } },
    { s: { r: qaHeaderRow, c: 10 }, e: { r: qaHeaderRow, c: 15 } },
    { s: { r: qaHeaderRow, c: 16 }, e: { r: qaHeaderRow, c: 21 } },
    { s: { r: qaHeaderRow, c: 22 }, e: { r: qaHeaderRow, c: 22 } }
  );
  wsData.push([
    "แบบประเมินพนักงาน QA", "", "", "",
    "1. การทำงานร่วมกับทีม/ประสานงาน (มนุษยสัมพันธ์ , มีการประสานงานร่วมกับทีม , ทักษะด้านอารมณ์)", "", "", "", "", "",
    "2. ความสามารถในการตัดสินใจ (ทักษะการแก้ปัญหา,ภาวะผู้นำ,กล้าตัดสินใจ)", "", "", "", "", "",
    "3. มีความยุติธรรม (ซื่อสัตย์ต่อหน้าที่ที่ตนรับผิดชอบ,ไม่เลือกปฏิบัติ)", "", "", "", "", "",
    "ข้อเสนอแนะ / ความคิดเห็นเพิ่มเติม",
  ]);

  wsData.push([
    "No.", "Name", "", "Department",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "ข้อเสนอแนะ (ผู้ประเมิน -> ข้อความ)",
  ]);

  qaEmployees.forEach((item, index) => {
    const { employee, evaluations } = item;
    const nameParts = employee.name.split(" ");
    const firstName = nameParts[0] || employee.name;
    const nickname = employee.nickname || (nameParts.length > 1 ? nameParts[1] : "");
    const deptDisplay = employee.position || (employee.team?.name ? `${employee.department?.name} / ${employee.team?.name}` : employee.department?.name) || "-";
    const qaWeights = { super: 5, ssuper: 2.5, head: 7.5, shead: 0 };

    const q1Super = getQuestionScore(evaluations, 0, "super");
    const q1SSuper = getQuestionScore(evaluations, 0, "ssuper");
    const q1Head = getQuestionScore(evaluations, 0, "head");
    const q1SHead = getQuestionScore(evaluations, 0, "shead");
    const q1Total = calcWeightedTotal({ super: q1Super, ssuper: q1SSuper, head: q1Head, shead: q1SHead }, qaWeights);
    const q1Interpretation = getScoreInterpretation(q1Total);

    const q2Super = getQuestionScore(evaluations, 1, "super");
    const q2SSuper = getQuestionScore(evaluations, 1, "ssuper");
    const q2Head = getQuestionScore(evaluations, 1, "head");
    const q2SHead = getQuestionScore(evaluations, 1, "shead");
    const q2Total = calcWeightedTotal({ super: q2Super, ssuper: q2SSuper, head: q2Head, shead: q2SHead }, qaWeights);
    const q2Interpretation = getScoreInterpretation(q2Total);

    const q3Super = getQuestionScore(evaluations, 2, "super");
    const q3SSuper = getQuestionScore(evaluations, 2, "ssuper");
    const q3Head = getQuestionScore(evaluations, 2, "head");
    const q3SHead = getQuestionScore(evaluations, 2, "shead");
    const q3Total = calcWeightedTotal({ super: q3Super, ssuper: q3SSuper, head: q3Head, shead: q3SHead }, qaWeights);
    const q3Interpretation = getScoreInterpretation(q3Total);

    const feedbackText = getEmployeeFeedback(evaluations);

    wsData.push([
      index + 1,
      firstName,
      nickname,
      deptDisplay,
      q1Super, q1SSuper, q1Head, q1SHead, q1Total, q1Interpretation,
      q2Super, q2SSuper, q2Head, q2SHead, q2Total, q2Interpretation,
      q3Super, q3SSuper, q3Head, q3SHead, q3Total, q3Interpretation,
      feedbackText,
    ]);
  });

  if (qaEmployees.length === 0) {
    wsData.push([1, "ไม่มีข้อมูลพนักงาน QA", "", "-", "", "", "", "", 0, "บกพร่อง", "", "", "", "", 0, "บกพร่อง", "", "", "", "", 0, "บกพร่อง", "-"]);
  }

  // Create worksheet from 2D array
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 6 },  // No.
    { wch: 18 }, // Name
    { wch: 10 }, // Nickname
    { wch: 20 }, // Department
    // Q1 (6 cols: Super, S.Super, H., S.Head, Total, แปลผล)
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
    // Q2 (6 cols)
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
    // Q3 (6 cols)
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
    // ข้อเสนอแนะ / ความคิดเห็นเพิ่มเติม
    { wch: 45 },
  ];

  worksheet["!merges"] = merges;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "สรุปคะแนนประเมิน");

  const exportFilename = filename || `สรุปคะแนนประเมิน_${periodName.replace(/\s+/g, "_")}`;
  XLSX.writeFile(workbook, `${exportFilename}.xlsx`);
}
