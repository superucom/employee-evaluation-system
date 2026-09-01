import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";
import { Role } from "@prisma/client";
import { getMainTeamName } from "@/lib/utils";

function getScoreInterpretation(score: number): string {
  if (score >= 4.5) return "ดีเยี่ยม";
  if (score >= 3.5) return "ดี";
  if (score >= 2.5) return "ผ่านเกณฑ์";
  if (score > 0) return "ต้องปรับปรุง";
  return "บกพร่อง";
}

function getEvaluatorRoleType(username: string, fullName: string): string {
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
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    if (currentUser.role !== Role.MANAGER) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId") ?? "";
    const mainTeam = searchParams.get("mainTeam") ?? "";
    const departmentId = searchParams.get("departmentId") ?? "";

    const periodWhere = periodId ? { id: periodId } : { status: "ACTIVE" };
    const period = await prisma.evaluationPeriod.findFirst({ where: periodWhere as any });
    if (!period) return NextResponse.json({ error: "ไม่พบรอบการประเมิน" }, { status: 404 });

    const records = await prisma.evaluationRecord.findMany({
      where: {
        periodId: period.id,
        status: "SUBMITTED",
        ...(departmentId && { employee: { departmentId } }),
      },
      include: {
        employee: {
          include: {
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true, code: true } },
          },
        },
        evaluatorUser: { select: { id: true, fullName: true, username: true } },
        scores: {
          include: {
            question: {
              include: { category: true },
            },
          },
        },
      },
    });

    // Filter by main team in memory (since team codes map via getMainTeamName)
    const filteredRecords = records.filter((r) => {
      if (!mainTeam || mainTeam === "ALL") return true;
      const tName = getMainTeamName(r.employee.team);
      const targetName = mainTeam === "TEAM_A" ? "ทีม A" : mainTeam === "TEAM_B" ? "ทีม B" : mainTeam === "TEAM_C" ? "ทีม C" : mainTeam;
      return tName === targetName;
    });

    // Group records by Employee
    const employeeMap = new Map<string, { employee: any; evaluations: any[] }>();
    for (const r of filteredRecords) {
      const empId = r.employee.id;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, { employee: r.employee, evaluations: [] });
      }
      employeeMap.get(empId)!.evaluations.push(r);
    }

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
        dept.includes("head") ||
        dept.includes("hrd");

      const getRoleScore = (qIndex: number, targetRole: string) => {
        const matchingScores: number[] = [];
        for (const ev of evaluations) {
          const roleType = getEvaluatorRoleType(ev.evaluatorUser?.username, ev.evaluatorUser?.fullName);
          if (roleType === targetRole && ev.scores && ev.scores.length > qIndex) {
            matchingScores.push(Number(ev.scores[qIndex]?.scoreValue || 0));
          }
        }
        if (matchingScores.length === 0) return null;
        return Math.round((matchingScores.reduce((a, b) => a + b, 0) / matchingScores.length) * 10) / 10;
      };

      const calcTotal = (...scores: (number | null)[]) => {
        const valid = scores.filter((s): s is number => s !== null);
        if (valid.length === 0) return null;
        return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
      };

      const nameParts = employee.name.split(" ");
      const firstName = nameParts[0] || employee.name;
      const nickname = employee.nickname || (nameParts.length > 1 ? nameParts[1] : "");
      const deptDisplay = employee.position || (employee.team?.name ? `${employee.department?.name} / ${employee.team?.name}` : employee.department?.name) || "-";

      if (isHead) {
        const q1Super = getRoleScore(0, "super");
        const q1SSuper = getRoleScore(0, "ssuper");
        const q1Total = calcTotal(q1Super, q1SSuper);

        const q2Super = getRoleScore(1, "super");
        const q2SSuper = getRoleScore(1, "ssuper");
        const q2Total = calcTotal(q2Super, q2SSuper);

        const q3Super = getRoleScore(2, "super");
        const q3SSuper = getRoleScore(2, "ssuper");
        const q3Total = calcTotal(q3Super, q3SSuper);

        headEmployees.push({
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          name: firstName,
          nickname,
          departmentName: deptDisplay,
          q1: { super: q1Super, ssuper: q1SSuper, total: q1Total, interp: q1Total !== null ? getScoreInterpretation(q1Total) : "-" },
          q2: { super: q2Super, ssuper: q2SSuper, total: q2Total, interp: q2Total !== null ? getScoreInterpretation(q2Total) : "-" },
          q3: { super: q3Super, ssuper: q3SSuper, total: q3Total, interp: q3Total !== null ? getScoreInterpretation(q3Total) : "-" },
        });
      } else {
        const q1Super = getRoleScore(0, "super");
        const q1SSuper = getRoleScore(0, "ssuper");
        const q1Head = getRoleScore(0, "head");
        const q1SHead = getRoleScore(0, "shead");
        const q1Total = calcTotal(q1Super, q1SSuper, q1Head, q1SHead);

        const q2Super = getRoleScore(1, "super");
        const q2SSuper = getRoleScore(1, "ssuper");
        const q2Head = getRoleScore(1, "head");
        const q2SHead = getRoleScore(1, "shead");
        const q2Total = calcTotal(q2Super, q2SSuper, q2Head, q2SHead);

        const q3Super = getRoleScore(2, "super");
        const q3SSuper = getRoleScore(2, "ssuper");
        const q3Head = getRoleScore(2, "head");
        const q3SHead = getRoleScore(2, "shead");
        const q3Total = calcTotal(q3Super, q3SSuper, q3Head, q3SHead);

        staffEmployees.push({
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          name: firstName,
          nickname,
          departmentName: deptDisplay,
          q1: { super: q1Super, ssuper: q1SSuper, head: q1Head, shead: q1SHead, total: q1Total, interp: q1Total !== null ? getScoreInterpretation(q1Total) : "-" },
          q2: { super: q2Super, ssuper: q2SSuper, head: q2Head, shead: q2SHead, total: q2Total, interp: q2Total !== null ? getScoreInterpretation(q2Total) : "-" },
          q3: { super: q3Super, ssuper: q3SSuper, head: q3Head, shead: q3SHead, total: q3Total, interp: q3Total !== null ? getScoreInterpretation(q3Total) : "-" },
        });
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

    const compareByDeptAndName = (a: { departmentName: string; name: string }, b: { departmentName: string; name: string }) => {
      const rankA = getDepartmentRank(a.departmentName);
      const rankB = getDepartmentRank(b.departmentName);
      if (rankA !== rankB) return rankA - rankB;
      const deptComp = (a.departmentName || "").localeCompare(b.departmentName || "", "th");
      if (deptComp !== 0) return deptComp;
      return (a.name || "").localeCompare(b.name || "", "th");
    };

    headEmployees.sort(compareByDeptAndName);
    staffEmployees.sort(compareByDeptAndName);

    return NextResponse.json({
      period,
      headEmployees,
      staffEmployees,
      rawRecords: filteredRecords,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
