import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { StatCards, QuickActions, RecentTable } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as any;

  if (!user) redirect("/login");

  if (user.role === Role.MANAGER) {
    return <ManagerDashboard userId={user.id} />;
  }
  return <EvaluatorDashboard userId={user.id} userName={user.name} />;
}

async function ManagerDashboard({ userId }: { userId: string }) {
  const [
    totalEmployees,
    totalEvaluators,
    totalDepartments,
    totalTeams,
    activePeriod,
    totalEvaluations,
    submittedEvaluations,
  ] = await Promise.all([
    prisma.employee.count({ where: { deletedAt: null, status: "active" } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true, role: "EVALUATOR" } }),
    prisma.department.count({ where: { deletedAt: null, isActive: true } }),
    prisma.team.count({ where: { deletedAt: null, isActive: true } }),
    prisma.evaluationPeriod.findFirst({ where: { status: "ACTIVE" } }),
    prisma.evaluationRecord.count({}),
    prisma.evaluationRecord.count({ where: { status: "SUBMITTED" } }),
  ]);

  const totalMainTeams = 3; // ทีม A, ทีม B, ทีม C
  const completionRate = totalEvaluations > 0 ? (submittedEvaluations / totalEvaluations) * 100 : 0;

  const stats = [
    { label: "พนักงานทั้งหมด", value: totalEmployees, icon: "👥", gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)", shadow: "rgba(59,130,246,0.35)" },
    { label: "ผู้ประเมิน", value: totalEvaluators, icon: "📋", gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)", shadow: "rgba(139,92,246,0.35)" },
    { label: "ทีมหลัก", value: totalMainTeams, icon: "👨‍👩‍👧‍👦", gradient: "linear-gradient(135deg,#10b981,#059669)", shadow: "rgba(16,185,129,0.35)" },
    { label: "ประเมินแล้ว", value: submittedEvaluations, icon: "✅", gradient: "linear-gradient(135deg,#22c55e,#16a34a)", shadow: "rgba(34,197,94,0.35)" },
    { label: "รอการประเมิน", value: Math.max(0, totalEvaluations - submittedEvaluations), icon: "⏳", gradient: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "rgba(245,158,11,0.35)" },
  ];

  const quickActions = [
    { label: "เพิ่มพนักงาน", href: "/employees", icon: "👤", desc: "เพิ่มพนักงานใหม่เข้าระบบ" },
    { label: "สร้างรอบประเมิน", href: "/evaluation-periods", icon: "📅", desc: "กำหนดรอบการประเมิน" },
    { label: "ดูรายงาน", href: "/reports/performance", icon: "📊", desc: "รายงานผลการประเมิน" },
    { label: "Audit Log", href: "/audit-logs", icon: "🔍", desc: "ประวัติการดำเนินการ" },
  ];

  const recent = await prisma.evaluationRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      employee: { select: { name: true, employeeCode: true } },
      evaluatorUser: { select: { fullName: true } },
      period: { select: { name: true } },
    },
  });

  const recentRows = recent.map((r) => ({
    id: r.id,
    employeeName: r.employee.name,
    employeeCode: r.employee.employeeCode,
    evaluatorName: r.evaluatorUser.fullName,
    periodName: r.period.name,
    finalPercentage: r.finalPercentage ? Number(r.finalPercentage).toFixed(1) : null,
    grade: r.grade,
    status: r.status,
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }}>Dashboard</h1>
            <p style={{ color: "#94a3b8", marginTop: "0.25rem", fontSize: "0.9rem" }}>ภาพรวมระบบประเมินผลการปฏิบัติงาน</p>
          </div>
          {activePeriod && (
            <span style={{ padding: "0.4rem 1rem", borderRadius: "9999px", fontSize: "0.8rem", fontWeight: 600, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 8px #4ade80" }} />
              รอบ: {activePeriod.name}
            </span>
          )}
        </div>
      </div>

      {/* Stat cards - Client Component */}
      <StatCards stats={stats} />

      {/* Middle row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.25rem", marginBottom: "1.75rem" }}>
        {/* Completion rate */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "1rem", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1.25rem" }}>
            อัตราความสำเร็จ
          </h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "2.75rem", fontWeight: 800, color: "#3b82f6", lineHeight: 1 }}>
                {completionRate.toFixed(1)}%
              </div>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.5rem" }}>
                {submittedEvaluations} / {totalEvaluations} รายการ
              </p>
            </div>
            <svg viewBox="0 0 36 36" style={{ width: 72, height: 72, transform: "rotate(-90deg)", flexShrink: 0 }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0f172a" strokeWidth="3.5" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${completionRate} ${100 - completionRate}`}
              />
            </svg>
          </div>
        </div>

        {/* Quick Actions - Client Component */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "1rem", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1.25rem" }}>
            ทางลัด
          </h3>
          <QuickActions actions={quickActions} />
        </div>
      </div>

      {/* Recent Evaluations Table - Client Component */}
      <RecentTable rows={recentRows} />
    </div>
  );
}

async function EvaluatorDashboard({ userId, userName }: { userId: string; userName: string }) {
  const activePeriod = await prisma.evaluationPeriod.findFirst({ where: { status: "ACTIVE" } });

  const myEvaluations = activePeriod
    ? await prisma.evaluationRecord.findMany({
        where: { evaluatorUserId: userId, periodId: activePeriod.id },
        include: { employee: { select: { id: true, name: true, employeeCode: true } } },
        orderBy: { evalStartDate: "desc" },
        take: 5,
      })
    : [];

  const assignments = await prisma.evaluatorAssignment.findMany({
    where: { evaluatorUserId: userId, isActive: true },
    include: {
      targetEmployee: { select: { id: true, name: true } },
      targetDepartment: { select: { id: true, name: true } },
      targetTeam: { select: { id: true, name: true } },
    },
    take: 10,
  });

  const submittedCount = myEvaluations.filter((e) => e.status === "SUBMITTED").length;
  const draftCount = myEvaluations.filter((e) => e.status === "DRAFT").length;

  const evalStats = [
    { label: "การมอบหมายของฉัน", value: assignments.length, icon: "📋", gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)", shadow: "rgba(59,130,246,0.35)" },
    { label: "ประเมินแล้วในรอบนี้", value: submittedCount, icon: "✅", gradient: "linear-gradient(135deg,#22c55e,#16a34a)", shadow: "rgba(34,197,94,0.35)" },
    { label: "ฉบับร่าง", value: draftCount, icon: "📝", gradient: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "rgba(245,158,11,0.35)" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#ffffff" }}>สวัสดี, {userName} 👋</h1>
        <p style={{ color: "#94a3b8", marginTop: "0.35rem" }}>
          {activePeriod ? `รอบการประเมิน: ${activePeriod.name}` : "ไม่มีรอบการประเมินที่เปิดอยู่"}
        </p>
      </div>

      <StatCards stats={evalStats} />

      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "1rem", padding: "1.5rem" }}>
        <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          การมอบหมายของฉัน
        </h3>
        {assignments.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>ยังไม่มีการมอบหมาย</p>
        ) : (
          <div>
            {assignments.map((a, idx) => (
              <div
                key={a.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: idx < assignments.length - 1 ? "1px solid #334155" : "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "0.5rem", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                    👤
                  </div>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#e2e8f0" }}>
                      {a.assignmentType === "EMPLOYEE" && a.targetEmployee?.name}
                      {a.assignmentType === "DEPARTMENT" && `แผนก: ${a.targetDepartment?.name}`}
                      {a.assignmentType === "TEAM" && `ทีม: ${a.targetTeam?.name}`}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {a.assignmentType === "EMPLOYEE" ? "พนักงาน" : a.assignmentType}
                    </div>
                  </div>
                </div>
                <span style={{ padding: "0.2rem 0.65rem", borderRadius: "9999px", fontSize: "0.72rem", fontWeight: 700, background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>
                  {Number(a.weightPercentage).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/evaluations" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginTop: "1rem", fontSize: "0.85rem", fontWeight: 600, color: "#3b82f6", textDecoration: "none" }}>
          ไปหน้าประเมิน →
        </Link>
      </div>
    </div>
  );
}
