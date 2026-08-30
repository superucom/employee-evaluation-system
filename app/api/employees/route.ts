import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth, requireManager } from "@/lib/auth/session";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validations/employee.schema";
import { createAuditLog } from "@/lib/services/audit.service";
import { AuditAction, Role } from "@prisma/client";
import { sortEmployees } from "@/lib/utils";

// GET /api/employees
export async function GET(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);
    const search = searchParams.get("search") ?? "";
    const departmentId = searchParams.get("departmentId") ?? "";
    const teamId = searchParams.get("teamId") ?? "";
    const mainTeam = searchParams.get("mainTeam") ?? "";
    const status = searchParams.get("status") ?? "";
    const sortBy = searchParams.get("sortBy") ?? "DEFAULT";
    const skip = (page - 1) * limit;

    let mainTeamCondition: any = null;
    if (mainTeam) {
      const upper = mainTeam.toUpperCase().trim();
      let suffix = "";
      if (upper.includes("TEAM_A") || upper.endsWith(" A") || upper === "A" || upper === "TEAM A" || upper.includes("ทีม A")) suffix = "A";
      else if (upper.includes("TEAM_B") || upper.endsWith(" B") || upper === "B" || upper === "TEAM B" || upper.includes("ทีม B")) suffix = "B";
      else if (upper.includes("TEAM_C") || upper.endsWith(" C") || upper === "C" || upper === "TEAM C" || upper.includes("ทีม C")) suffix = "C";
      else if (upper.includes("TEAM_D") || upper.endsWith(" D") || upper === "D" || upper === "TEAM D" || upper.includes("ทีม D")) suffix = "D";

      if (suffix) {
        mainTeamCondition = {
          OR: [
            { name: { contains: `Team ${suffix}`, mode: "insensitive" } },
            { name: { endsWith: ` ${suffix}`, mode: "insensitive" } },
            { code: { contains: `TEAM_${suffix}`, mode: "insensitive" } },
            { code: { endsWith: `_${suffix}`, mode: "insensitive" } },
          ],
        };
      }
    }

    let where: any = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { employeeCode: { contains: search, mode: "insensitive" } },
          { nickname: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(departmentId && { departmentId }),
      ...(teamId && { teamId }),
      ...(mainTeamCondition && { team: mainTeamCondition }),
      ...(status && { status }),
    };

    // Evaluator scope: Check assignments + Team hierarchy (e.g. Super Team A can evaluate both CC Team A and Sale Team A)
    if (currentUser.role === Role.EVALUATOR) {
      const user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        include: { team: true },
      });

      const assignments = await prisma.evaluatorAssignment.findMany({
        where: { evaluatorUserId: currentUser.id, isActive: true },
        select: {
          assignmentType: true,
          targetEmployeeId: true,
          targetDepartmentId: true,
          targetTeamId: true,
        },
      });

      const employeeIds = new Set<string>();
      const deptIds = new Set<string>();
      const teamIds = new Set<string>();

      for (const a of assignments) {
        if (a.assignmentType === "EMPLOYEE" && a.targetEmployeeId) employeeIds.add(a.targetEmployeeId);
        if (a.assignmentType === "DEPARTMENT" && a.targetDepartmentId) deptIds.add(a.targetDepartmentId);
        if (a.assignmentType === "TEAM" && a.targetTeamId) teamIds.add(a.targetTeamId);
      }

      // If user has a team assigned (e.g. CC Team A or Sale Team A), include matching sister teams in the same team group
      if (user?.team?.name) {
        const teamName = user.team.name.toUpperCase();
        let teamSuffix = "";
        if (teamName.includes("TEAM A") || teamName.endsWith(" A")) teamSuffix = "A";
        else if (teamName.includes("TEAM B") || teamName.endsWith(" B")) teamSuffix = "B";
        else if (teamName.includes("TEAM C") || teamName.endsWith(" C")) teamSuffix = "C";

        if (teamSuffix) {
          const sisterTeams = await prisma.team.findMany({
            where: {
              deletedAt: null,
              OR: [
                { name: { contains: `Team ${teamSuffix}`, mode: "insensitive" } },
                { code: { contains: `TEAM_${teamSuffix}`, mode: "insensitive" } },
              ],
            },
            select: { id: true },
          });
          sisterTeams.forEach((t) => teamIds.add(t.id));
        } else {
          teamIds.add(user.team.id);
        }
      }

      const orConditions: any[] = [];
      if (employeeIds.size > 0) orConditions.push({ id: { in: [...employeeIds] } });
      if (deptIds.size > 0) orConditions.push({ departmentId: { in: [...deptIds] } });
      if (teamIds.size > 0) orConditions.push({ teamId: { in: [...teamIds] } });

      if (orConditions.length > 0) {
        where = {
          ...where,
          OR: orConditions,
        };
      }
    }

    const allMatching = await prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, code: true } },
      },
    });

    const total = allMatching.length;
    const sorted = sortEmployees(allMatching, sortBy);
    const paginated = sorted.slice(skip, skip + limit);

    return NextResponse.json({ data: paginated, meta: { total, page, limit } });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    console.error("GET /api/employees error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// POST /api/employees (Manager only)
export async function POST(req: NextRequest) {
  try {
    const manager = await requireManager();
    const body = await req.json();
    const parsed = createEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check duplicate employee code
    const existing = await prisma.employee.findFirst({
      where: { employeeCode: parsed.data.employeeCode, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json({ error: "รหัสพนักงานนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode: parsed.data.employeeCode,
        name: parsed.data.name,
        nickname: parsed.data.nickname ?? null,
        departmentId: parsed.data.departmentId,
        teamId: parsed.data.teamId ?? null,
        position: parsed.data.position ?? null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
      include: {
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: manager.id,
      action: AuditAction.CREATE,
      entityType: "Employee",
      entityId: employee.id,
      newValue: { employeeCode: employee.employeeCode, name: employee.name },
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
    console.error("POST /api/employees error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
