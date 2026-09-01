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
    activePeriod,
    submittedEvaluations,
    activeTeams,
  ] = await Promise.all([
    prisma.employee.count({ where: { deletedAt: null, status: "active" } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true, role: "EVALUATOR" } }),
    prisma.department.count({ where: { deletedAt: null, isActive: true } }),
    prisma.evaluationPeriod.findFirst({ where: { status: "ACTIVE" }, orderBy: { startDate: "desc" } }),
    prisma.evaluationRecord.count({ where: { status: "SUBMITTED" } }),
    prisma.team.findMany({ where: { deletedAt: null, isActive: true }, select: { name: true, code: true } }),
  ]);

  // Count distinct main team groups (Team A / B / C / D) from actual DB data
  const { getMainTeamName } = await import("@/lib/utils");
  const mainTeamNames = new Set(activeTeams.map((t) => getMainTeamName(t)));
  const totalMainTeams = mainTeamNames.size;

  // Completion rate: submitted vs total active assignments (expected evaluations)
  // Use submitted evaluations vs total evaluations in the active period (submitted + draft)
  const totalEvaluations = await prisma.evaluationRecord.count({
    where: activePeriod ? { periodId: activePeriod.id } : undefined,
  });
  const completionRate = totalEvaluations > 0 ? (submittedEvaluations / totalEvaluations) * 100 : 0;

  const stats = [
    { label: "พนักงานทั้งหมด", value: totalEmployees, icon: "👥", gradient: "#8EA597", shadow: "rgba(142,165,151,0.25)" },
    { label: "ผู้ประเมิน", value: totalEvaluators, icon: "📋", gradient: "#7A9183", shadow: "rgba(122,145,131,0.25)" },
    { label: "ทีมหลัก", value: totalMainTeams, icon: "🏛️", gradient: "#6E8777", shadow: "rgba(110,135,119,0.25)" },
    { label: "ประเมินแล้ว", value: submittedEvaluations, icon: "✓", gradient: "#5B7565", shadow: "rgba(91,117,101,0.25)" },
    { label: "รอการประเมิน", value: Math.max(0, totalEvaluations - submittedEvaluations), icon: "⏳", gradient: "#9EAFA5", shadow: "rgba(158,175,165,0.25)" },
    { label: "แผนก", value: totalDepartments, icon: "🏢", gradient: "#A8BFB3", shadow: "rgba(168,191,179,0.25)" },
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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* ================= CENTERED TITLE & DESCRIPTION ================= */}
      <header className="text-center py-6 border-b border-[#E6E0D2]">
        <div className="inline-flex items-center justify-center gap-3 mb-3">
          <span className="w-10 h-[1.5px] bg-[#8EA597]" />
          <span className="w-2 h-2 rounded-full bg-[#8EA597]" />
          <span className="w-10 h-[1.5px] bg-[#8EA597]" />
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1F1E1C] tracking-tight">
          แดชบอร์ดภาพรวมการประเมิน
        </h1>
        
        <p className="mt-2 text-base sm:text-lg text-[#685C53] max-w-xl mx-auto font-normal">
          ระบบประเมินผลการปฏิบัติงานพนักงานรายวัน • Performance Evaluation
        </p>

        {activePeriod && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8EFEA] border border-[#8EA597] text-xs font-semibold text-[#2D4438]">
            <span className="w-2 h-2 rounded-full bg-[#8EA597]" />
            <span>รอบการประเมินปัจจุบัน: <strong>{activePeriod.name}</strong></span>
          </div>
        )}
      </header>

      {/* Stat cards */}
      <StatCards stats={stats} />

      {/* Middle row: Completion Rate & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Completion rate Card */}
        <div className="bg-white border border-[#8EA597]/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E6E0D2] pb-3 mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5A4D42]">
                อัตราความสำเร็จ
              </h3>
              <span className="text-xs font-semibold text-[#8EA597]">COMPLETION</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-[#1F1E1C]">
                  {completionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-[#685C53] mt-2">
                  เสร็จสิ้น {submittedEvaluations} จากทั้งหมด {totalEvaluations} รายการ
                </p>
              </div>

              {/* Minimalist Circular Meter */}
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90 flex-shrink-0">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E8EFEA" strokeWidth="3.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#8EA597"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${completionRate} ${100 - completionRate}`}
                />
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E6E0D2] text-xs text-[#8C7E72] text-center">
            รอบประเมินกำลังดำเนินการตามเกณฑ์มาตรฐาน
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="lg:col-span-2 bg-white border border-[#8EA597]/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E6E0D2] pb-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5A4D42]">
              ทางลัดการทำงาน
            </h3>
            <span className="text-xs font-semibold text-[#8EA597]">QUICK ACTIONS</span>
          </div>
          <QuickActions actions={quickActions} />
        </div>
      </div>

      {/* Recent Evaluations Table */}
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
    { label: "การมอบหมายของฉัน", value: assignments.length, icon: "📋", gradient: "#8EA597", shadow: "rgba(142,165,151,0.25)" },
    { label: "ประเมินแล้วในรอบนี้", value: submittedCount, icon: "✓", gradient: "#7A9183", shadow: "rgba(122,145,131,0.25)" },
    { label: "ฉบับร่าง", value: draftCount, icon: "📝", gradient: "#9EAFA5", shadow: "rgba(158,175,165,0.25)" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Centered Evaluator Header */}
      <header className="text-center py-6 border-b border-[#E6E0D2]">
        <div className="inline-flex items-center justify-center gap-3 mb-3">
          <span className="w-10 h-[1.5px] bg-[#8EA597]" />
          <span className="w-2 h-2 rounded-full bg-[#8EA597]" />
          <span className="w-10 h-[1.5px] bg-[#8EA597]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1F1E1C]">
          สวัสดี, {userName}
        </h1>
        <p className="mt-2 text-base text-[#685C53]">
          {activePeriod ? `รอบการประเมิน: ${activePeriod.name}` : "ไม่มีรอบการประเมินที่เปิดอยู่"}
        </p>
      </header>

      <StatCards stats={evalStats} />

      <div className="bg-white border border-[#8EA597]/50 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5A4D42] mb-4 border-b border-[#E6E0D2] pb-3">
          การมอบหมายของฉัน
        </h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-[#8C7E72] py-4">ยังไม่มีการมอบหมายในระบบ</p>
        ) : (
          <div className="divide-y divide-[#E6E0D2]">
            {assignments.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#1F1E1C]">
                    {a.assignmentType === "EMPLOYEE" && a.targetEmployee?.name}
                    {a.assignmentType === "DEPARTMENT" && `แผนก: ${a.targetDepartment?.name}`}
                    {a.assignmentType === "TEAM" && `ทีม: ${a.targetTeam?.name}`}
                  </div>
                  <div className="text-xs text-[#8C7E72]">
                    {a.assignmentType === "EMPLOYEE" ? "พนักงานรายบุคคล" : a.assignmentType}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs bg-[#E8EFEA] border border-[#8EA597] text-[#2D4438] font-semibold">
                  น้ำหนัก {Number(a.weightPercentage).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 pt-4 border-t border-[#E6E0D2]">
          <Link
            href="/evaluations"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#3B5145] hover:text-[#16241D]"
          >
            <span>ไปยังหน้ารายการประเมิน</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
