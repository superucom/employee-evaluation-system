import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";
import { calculateWorkingDays, getOverlappingWorkingDays } from "@/lib/calculations/working-days";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const body = await req.json();
    const { periodId, employeeId, evalStartDate, evalEndDate, excludeRecordId } = body;

    if (!periodId || !employeeId || !evalStartDate || !evalEndDate) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    // Get holidays
    const workingDayConfigs = await prisma.workingDayConfig.findMany({
      where: { periodId, isWorkingDay: false },
      select: { date: true },
    });
    const holidays = workingDayConfigs.map((c) => c.date);

    // Calculate working days
    const workingDaysCount = calculateWorkingDays(evalStartDate, evalEndDate, holidays);

    // Find existing evaluations
    const existingRecords = await prisma.evaluationRecord.findMany({
      where: {
        periodId,
        employeeId,
        evaluatorUserId: currentUser.id,
        status: { not: "DRAFT" },
        ...(excludeRecordId ? { id: { not: excludeRecordId } } : {}),
      },
      select: { evalStartDate: true, evalEndDate: true },
    });

    const overlappingDays = getOverlappingWorkingDays(
      { startDate: evalStartDate, endDate: evalEndDate },
      existingRecords.map((r) => ({
        startDate: r.evalStartDate,
        endDate: r.evalEndDate,
      })),
      holidays
    );

    return NextResponse.json({
      workingDaysCount,
      hasOverlap: overlappingDays.length > 0,
      overlappingDays,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
