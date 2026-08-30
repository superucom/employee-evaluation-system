import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireManager } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/services/audit.service";
import { AuditAction, PeriodStatus } from "@prisma/client";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireManager();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.evaluationPeriod.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "ไม่พบรอบการประเมิน" }, { status: 404 });

    // Cannot edit a locked period
    if (existing.status === PeriodStatus.LOCKED && body.status !== PeriodStatus.DRAFT) {
      return NextResponse.json({ error: "รอบการประเมินนี้ถูกล็อกแล้ว" }, { status: 400 });
    }

    const auditAction = body.status === PeriodStatus.LOCKED
      ? AuditAction.LOCK_PERIOD
      : body.status === PeriodStatus.ACTIVE
        ? AuditAction.UNLOCK_PERIOD
        : AuditAction.UPDATE;

    const updated = await prisma.evaluationPeriod.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
        ...(body.expectedWorkingDays !== undefined && { expectedWorkingDays: body.expectedWorkingDays }),
        ...(body.startDate && { startDate: new Date(body.startDate) }),
        ...(body.endDate && { endDate: new Date(body.endDate) }),
      },
    });

    await createAuditLog({
      userId: manager.id,
      action: auditAction,
      entityType: "EvaluationPeriod",
      entityId: id,
      oldValue: { status: existing.status, name: existing.name },
      newValue: { status: updated.status, name: updated.name },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
