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

  // Separate employees into Head group and Staff group
  const headEmployees: any[] = [];
  const staffEmployees: any[] = [];

  employeeMap.forEach(({ employee, evaluations }) => {
    const pos = (employee.position || "").toLowerCase();
    const dept = (employee.department?.name || "").toLowerCase();
    const isHead =
      pos.includes("head") ||
      pos.includes("sup") ||
      pos.includes("lead") ||
      pos.includes("manager") ||
      pos.includes("hrd") ||
      pos.includes("transfer") ||
      dept.includes("head") ||
      dept.includes("hrd");

    const item = { employee, evaluations };
    if (isHead) {
      headEmployees.push(item);
    } else {
      staffEmployees.push(item);
    }
  });

  // Sort by name
  headEmployees.sort((a, b) => a.employee.name.localeCompare(b.employee.name, "th"));
  staffEmployees.sort((a, b) => a.employee.name.localeCompare(b.employee.name, "th"));

  // Build 2D rows for SheetJS
  const wsData: any[][] = [];

  // Row 1: Title Banner (Team / Dept)
  wsData.push([`แปลผลคะแนนประเมิน ${teamOrDeptName}`]);
  // Row 2: Month / Period
  wsData.push([`ประจำเดือน ${periodName}`]);
  // Row 3: Blank separator
  wsData.push([]);

  // =========================================================
  // SECTION 1: แบบประเมินพนักงาน Head
  // =========================================================
  // Row 4: Section Header
  wsData.push([
    "แบบประเมินพนักงาน Head", "", "", "",
    "1. การทำงานร่วมกับทีม/ประสานงาน (มนุษยสัมพันธ์ , มีการประสานงานร่วมกับทีม , ทักษะด้านอารมณ์)", "", "", "",
    "2. ความสามารถในการตัดสินใจ (ทักษะการแก้ปัญหา,ภาวะผู้นำ,กล้าตัดสินใจ)", "", "", "",
    "3. มีความยุติธรรม (ซื่อสัตย์ต่อหน้าที่ที่ตนรับผิดชอบ,ไม่เลือกปฏิบัติ)", "", "", "",
  ]);

  // Row 5: Column Subheaders
  wsData.push([
    "No.", "Name", "", "Department",
    "Super", "S.Sup", "Total", "แปลผล",
    "Super", "S.Sup", "Total", "แปลผล",
    "Super", "S.Sup", "Total", "แปลผล",
  ]);

  const headStartRow = wsData.length + 1; // 1-indexed for merge/reference

  const getEvaluatorRoleType = (username: string, fullName: string): string => {
    const u = (username || "").toLowerCase();
    const f = (fullName || "").toLowerCase();

    // 1. Support Head
    if (u.includes("shead") || f.includes("support head") || f.includes("support.h") || f.includes("sup_head")) {
      return "shead";
    }

    // 2. Support Super
    if (u.includes("ssuper") || f.includes("supportsuper") || f.includes("support super")) {
      return "ssuper";
    }

    // 3. Super (make sure not support super)
    if (u.includes("super") || f.includes("super")) {
      return "super";
    }

    // 4. Head
    if (u.includes("head") || f.includes("head")) {
      return "head";
    }
    return "other";
  };

  // Helper to extract question score for an employee
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

  // Helper to calculate total for question
  const getQuestionTotal = (...scores: any[]) => {
    const nums = scores.filter((v) => typeof v === "number");
    if (nums.length === 0) return 0;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
  };

  headEmployees.forEach((item, index) => {
    const { employee, evaluations } = item;
    const nameParts = employee.name.split(" ");
    const firstName = nameParts[0] || employee.name;
    const nickname = employee.nickname || (nameParts.length > 1 ? nameParts[1] : "");
    const deptDisplay = employee.position || employee.department?.name || "-";

    // Q1
    const q1Super = getQuestionScore(evaluations, 0, "super");
    const q1SSuper = getQuestionScore(evaluations, 0, "ssuper");
    const q1Total = getQuestionTotal(q1Super, q1SSuper);
    const q1Interpretation = getScoreInterpretation(q1Total);

    // Q2
    const q2Super = getQuestionScore(evaluations, 1, "super");
    const q2SSuper = getQuestionScore(evaluations, 1, "ssuper");
    const q2Total = getQuestionTotal(q2Super, q2SSuper);
    const q2Interpretation = getScoreInterpretation(q2Total);

    // Q3
    const q3Super = getQuestionScore(evaluations, 2, "super");
    const q3SSuper = getQuestionScore(evaluations, 2, "ssuper");
    const q3Total = getQuestionTotal(q3Super, q3SSuper);
    const q3Interpretation = getScoreInterpretation(q3Total);

    wsData.push([
      index + 1,
      firstName,
      nickname,
      deptDisplay,
      q1Super, q1SSuper, q1Total, q1Interpretation,
      q2Super, q2SSuper, q2Total, q2Interpretation,
      q3Super, q3SSuper, q3Total, q3Interpretation,
    ]);
  });

  // If no head employees, add empty placeholder row
  if (headEmployees.length === 0) {
    wsData.push([1, "ไม่มีข้อมูลพนักงานระดับ Head", "", "-", "", "", 0, "บกพร่อง", "", "", 0, "บกพร่อง", "", "", 0, "บกพร่อง"]);
  }

  // Separator
  wsData.push([]);

  // =========================================================
  // SECTION 2: แบบประเมินพนักงาน Staff
  // =========================================================
  // Section Header
  wsData.push([
    "แบบประเมินพนักงาน Staff", "", "", "",
    "1. การทำงานร่วมกับทีม/ประสานงาน (มนุษยสัมพันธ์ , มีการประสานงานร่วมกับทีม , ทักษะด้านอารมณ์)", "", "", "", "", "",
    "2. ความรับผิดชอบต่อหน้างาน (ความรับผิดชอบ, ตรงต่อเวลา, การส่งมอบงาน)", "", "", "", "", "",
    "3. ความรู้ความสามารถเกี่ยวกับหน้างาน (ทักษะเฉพาะทาง, ความถูกต้องแม่นยำ)", "", "", "", "", "",
  ]);

  // Column Subheaders (Staff has Super, S.Super, H., S.Head, Total, แปลผล)
  wsData.push([
    "No.", "Name", "", "Department",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
    "Super", "S.Super", "H.", "S.Head", "Total", "แปลผล",
  ]);

  const staffOffset = headEmployees.length;

  staffEmployees.forEach((item, index) => {
    const { employee, evaluations } = item;
    const nameParts = employee.name.split(" ");
    const firstName = nameParts[0] || employee.name;
    const nickname = employee.nickname || (nameParts.length > 1 ? nameParts[1] : "");
    const deptDisplay = employee.position || (employee.team?.name ? `${employee.department?.name} / ${employee.team?.name}` : employee.department?.name) || "-";

    // Q1
    const q1Super = getQuestionScore(evaluations, 0, "super");
    const q1SSuper = getQuestionScore(evaluations, 0, "ssuper");
    const q1Head = getQuestionScore(evaluations, 0, "head");
    const q1SHead = getQuestionScore(evaluations, 0, "shead");
    const q1Total = getQuestionTotal(q1Super, q1SSuper, q1Head, q1SHead);
    const q1Interpretation = getScoreInterpretation(q1Total);

    // Q2
    const q2Super = getQuestionScore(evaluations, 1, "super");
    const q2SSuper = getQuestionScore(evaluations, 1, "ssuper");
    const q2Head = getQuestionScore(evaluations, 1, "head");
    const q2SHead = getQuestionScore(evaluations, 1, "shead");
    const q2Total = getQuestionTotal(q2Super, q2SSuper, q2Head, q2SHead);
    const q2Interpretation = getScoreInterpretation(q2Total);

    // Q3
    const q3Super = getQuestionScore(evaluations, 2, "super");
    const q3SSuper = getQuestionScore(evaluations, 2, "ssuper");
    const q3Head = getQuestionScore(evaluations, 2, "head");
    const q3SHead = getQuestionScore(evaluations, 2, "shead");
    const q3Total = getQuestionTotal(q3Super, q3SSuper, q3Head, q3SHead);
    const q3Interpretation = getScoreInterpretation(q3Total);

    wsData.push([
      staffOffset + index + 1,
      firstName,
      nickname,
      deptDisplay,
      q1Super, q1SSuper, q1Head, q1SHead, q1Total, q1Interpretation,
      q2Super, q2SSuper, q2Head, q2SHead, q2Total, q2Interpretation,
      q3Super, q3SSuper, q3Head, q3SHead, q3Total, q3Interpretation,
    ]);
  });

  if (staffEmployees.length === 0) {
    wsData.push([staffOffset + 1, "ไม่มีข้อมูลพนักงานทั่วไป", "", "-", "", "", "", "", 0, "บกพร่อง", "", "", "", "", 0, "บกพร่อง", "", "", "", "", 0, "บกพร่อง"]);
  }

  // Create worksheet from 2D array
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 6 },  // No.
    { wch: 18 }, // Name
    { wch: 10 }, // Nickname
    { wch: 18 }, // Department
    // Q1 (6 cols: Super, S.Super, H., S.Head, Total, แปลผล)
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
    // Q2 (6 cols)
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
    // Q3 (6 cols)
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
  ];

  // Set Merges
  const merges: XLSX.Range[] = [
    // Row 1 Title: A1:V1 (22 cols)
    { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } },
    // Row 2 Month: A2:V2 (22 cols)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 21 } },
    // Section 1 Header (Head): A4:D4, E4:H4, I4:L4, M4:P4
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 7 } },
    { s: { r: 3, c: 8 }, e: { r: 3, c: 11 } },
    { s: { r: 3, c: 12 }, e: { r: 3, c: 15 } },
  ];

  worksheet["!merges"] = merges;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "สรุปคะแนนประเมิน");

  const exportFilename = filename || `สรุปคะแนนประเมิน_${periodName.replace(/\s+/g, "_")}`;
  XLSX.writeFile(workbook, `${exportFilename}.xlsx`);
}
