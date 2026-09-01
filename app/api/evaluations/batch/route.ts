import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/services/audit.service";
import { AuditAction, EvaluationStatus } from "@prisma/client";
import {
  calculateEvaluationScore,
  scoreToPercentage,
  calculateWeightedScore,
  calculateGrade,
} from "@/lib/calculations/score";
import { calculateWorkingDays } from "@/lib/calculations/working-days";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const body = await req.json();

    const { periodId, evalStartDate, evalEndDate, isDraft, evaluations } = body;

    if (
      !periodId ||
      !evalStartDate ||
      !evalEndDate ||
      !Array.isArray(evaluations) ||
      evaluations.length === 0
    ) {
      return NextResponse.json({ error: "ข้อมูลการประเมินไม่ครบถ้วน" }, { status: 400 });
    }

    // Verify period exists and is not locked
    const period = await prisma.evaluationPeriod.findUnique({ where: { id: periodId } });
    if (!period) return NextResponse.json({ error: "ไม่พบรอบการประเมิน" }, { status: 404 });
    if (period.status === "LOCKED") {
      return NextResponse.json({ error: "รอบการประเมินนี้ถูกล็อกแล้ว" }, { status: 400 });
    }

    // Get holidays for working day calculation
    const workingDayConfigs = await prisma.workingDayConfig.findMany({
      where: { periodId, isWorkingDay: false },
      select: { date: true },
    });
    const holidays = workingDayConfigs.map((c) => c.date);
    const workingDaysCount = calculateWorkingDays(evalStartDate, evalEndDate, holidays);

    // Get score scales & grade configs
    const defaultScale = await prisma.scoreScale.findFirst({
      where: { isDefault: true, isActive: true },
    });
    const minScore = defaultScale?.minScore ?? 1;
    const maxScore = defaultScale?.maxScore ?? 5;

    const gradeConfigs = await prisma.gradeConfig.findMany({
      where: { isActive: true },
      orderBy: { minPercentage: "desc" },
    });
    const gradeRange = gradeConfigs.map((g) => ({
      label: g.label,
      minPercentage: Number(g.minPercentage),
      maxPercentage: Number(g.maxPercentage),
    }));

    // Get assignments for evaluator
    const assignments = await prisma.evaluatorAssignment.findMany({
      where: { evaluatorUserId: currentUser.id, isActive: true },
    });

    const status = isDraft === true ? EvaluationStatus.DRAFT : EvaluationStatus.SUBMITTED;
    const submittedAt = isDraft === true ? null : new Date();

    // Prefetch all employees in ONE single query
    const empIds = evaluations.map((e: any) => e.employeeId).filter(Boolean);
    const employees = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, departmentId: true, teamId: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    // Process all employee evaluations with generous timeout & parallel insertion
    const createdRecords = await prisma.$transaction(
      async (tx) => {
        // Delete any existing records for these employees in this period by this evaluator to avoid duplicate errors
        await tx.evaluationRecord.deleteMany({
          where: {
            periodId,
            evaluatorUserId: currentUser.id,
            employeeId: { in: empIds },
          },
        });

        const createPromises = evaluations.map((item: any) => {
          const { employeeId, comment, scores } = item;
          if (!employeeId || !scores || scores.length === 0) return null;

          const emp = empMap.get(employeeId);
          if (!emp) return null;

          const scoreValues = scores.map((s: any) => ({
            scoreValue: s.scoreValue,
            minScore,
            maxScore,
          }));
          const rawScore = calculateEvaluationScore(scoreValues);
          const rawPercentage = scoreToPercentage(rawScore, minScore, maxScore);

          // Prioritize assignment matching: EMPLOYEE (most specific) > TEAM > DEPARTMENT
          const assignment =
            assignments.find((a) => a.targetEmployeeId === employeeId) ||
            assignments.find((a) => a.targetTeamId && emp.teamId && a.targetTeamId === emp.teamId) ||
            assignments.find((a) => a.targetDepartmentId && a.targetDepartmentId === emp.departmentId);
          const weightPercentage = Number(assignment?.weightPercentage ?? 0);
          const weightedScore = calculateWeightedScore(rawPercentage, weightPercentage);
          const grade = calculateGrade(rawPercentage, gradeRange);

          return tx.evaluationRecord.create({
            data: {
              periodId,
              employeeId,
              evaluatorUserId: currentUser.id,
              evalStartDate: new Date(evalStartDate),
              evalEndDate: new Date(evalEndDate),
              workingDaysCount,
              status,
              comment: comment || null,
              rawScore,
              weightedScore,
              finalPercentage: rawPercentage,
              grade,
              submittedAt,
              scores: {
                create: scores.map((s: any) => ({
                  questionId: s.questionId,
                  scoreValue: s.scoreValue,
                  comment: s.comment || null,
                })),
              },
            },
          });
        });

        const results = await Promise.all(createPromises.filter(Boolean));
        return results;
      },
      {
        maxWait: 30000,
        timeout: 60000,
      }
    );

    await createAuditLog({
      userId: currentUser.id,
      action: isDraft ? AuditAction.CREATE : AuditAction.SUBMIT_EVALUATION,
      entityType: "EvaluationRecord",
      newValue: {
        count: createdRecords.length,
        periodId,
        evalStartDate,
        evalEndDate,
        status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `บันทึกผลการประเมินพนักงาน ${createdRecords.length} คน เรียบร้อยแล้ว`,
        count: createdRecords.length,
        data: createdRecords,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
    console.error("POST /api/evaluations/batch error:", error);
    return NextResponse.json(
      { error: error?.message || "เกิดข้อผิดพลาดในการบันทึกการประเมินรวม" },
      { status: 500 }
    );
  }
}
