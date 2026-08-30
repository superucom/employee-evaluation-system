"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ---- Icons (20x20) ----
const DashboardIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const UsersIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const BuildingIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M3 21h18M9 21V3l6 4v14M9 7H3v14M15 12h3M15 16h3" />
  </svg>
);
const ClipboardIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const StarIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const ChartIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const UserIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const FileIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);
const PeopleIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);
const KeyIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6M15.5 7.5l3 3" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);
const MenuIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);
const CloseIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const MANAGER_NAV: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [{ label: "Dashboard", href: "/dashboard", icon: <DashboardIcon /> }],
  },
  {
    label: "การประเมิน",
    items: [
      { label: "รอบการประเมิน", href: "/evaluation-periods", icon: <CalendarIcon /> },
      { label: "ประเมินผลพนักงาน", href: "/my-employees", icon: <UsersIcon /> },
      { label: "ผลการประเมิน", href: "/evaluations", icon: <ClipboardIcon /> },
    ],
  },
  {
    label: "พนักงาน",
    items: [
      { label: "พนักงาน", href: "/employees", icon: <UsersIcon /> },
      { label: "ทีมและแผนก", href: "/teams", icon: <PeopleIcon /> },
    ],
  },
  {
    label: "ตั้งค่าเกณฑ์",
    items: [
      { label: "หมวดหมู่", href: "/evaluation-criteria/categories", icon: <StarIcon /> },
      { label: "คำถาม", href: "/evaluation-criteria/questions", icon: <ClipboardIcon /> },
      { label: "เกณฑ์คะแนน", href: "/evaluation-criteria/score-criteria", icon: <ChartIcon /> },
      { label: "เกรด", href: "/evaluation-criteria/grades", icon: <StarIcon /> },
    ],
  },
  {
    label: "ผู้ใช้งาน",
    items: [
      { label: "จัดการผู้ใช้", href: "/users", icon: <UserIcon /> },
      { label: "การมอบหมาย", href: "/evaluator-assignments", icon: <ShieldIcon /> },
    ],
  },
  {
    label: "รายงาน",
    items: [
      { label: "แปลผลคะแนนองค์กร", href: "/reports/matrix", icon: <FileIcon /> },
      { label: "รายงานผลงาน", href: "/reports/performance", icon: <FileIcon /> },
      { label: "รายงานความสำเร็จ", href: "/reports/completion", icon: <ChartIcon /> },
      { label: "Audit Log", href: "/audit-logs", icon: <ShieldIcon /> },
    ],
  },
];

const EVALUATOR_NAV: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [{ label: "Dashboard", href: "/dashboard", icon: <DashboardIcon /> }],
  },
  {
    label: "การประเมิน",
    items: [
      { label: "พนักงานของฉัน", href: "/my-employees", icon: <UsersIcon /> },
      { label: "รอการประเมิน", href: "/evaluations", icon: <ClipboardIcon /> },
    ],
  },
  {
    label: "บัญชีของฉัน",
    items: [{ label: "เปลี่ยน Password", href: "/change-password", icon: <KeyIcon /> }],
  },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const navGroups = role === "MANAGER" ? MANAGER_NAV : EVALUATOR_NAV;
  const [open, setOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: "1.25rem 1rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "0.75rem",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
            }}
          >
            <ClipboardIcon />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#fff", lineHeight: 1.3 }}>ระบบประเมินผล</p>
            <p style={{ fontSize: "0.7rem", color: "#64748b", lineHeight: 1.3 }}>Performance Evaluation</p>
          </div>
        </div>
        {/* Role badge */}
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.3rem 0.75rem",
            borderRadius: "9999px",
            fontSize: "0.7rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            background: role === "MANAGER" ? "rgba(59,130,246,0.15)" : "rgba(168,85,247,0.15)",
            color: role === "MANAGER" ? "#60a5fa" : "#c084fc",
            border: `1px solid ${role === "MANAGER" ? "rgba(59,130,246,0.3)" : "rgba(168,85,247,0.3)"}`,
          }}
        >
          <span>{role === "MANAGER" ? "👔" : "📋"}</span>
          {role === "MANAGER" ? "ผู้จัดการ" : "ผู้ประเมิน"}
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "0.75rem 0.5rem", overflowY: "auto" }}>
        {navGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: "0.25rem" }}>
            <p
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0.75rem 0.75rem 0.35rem",
              }}
            >
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.65rem",
                    fontSize: "0.84rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#fff" : "#94a3b8",
                    background: isActive ? "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(29,78,216,0.15))" : "transparent",
                    border: isActive ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                    marginBottom: "0.15rem",
                    transition: "all 0.15s ease",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                    }
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0, color: isActive ? "#60a5fa" : "currentColor" }}>
                    {item.icon}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        marginLeft: "auto",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#3b82f6",
                        flexShrink: 0,
                        boxShadow: "0 0 8px #3b82f6",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: "0.75rem 0.5rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          id="logout-btn"
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            padding: "0.65rem 0.75rem",
            borderRadius: "0.65rem",
            fontSize: "0.84rem",
            fontWeight: 500,
            color: "#f87171",
            background: "transparent",
            border: "1px solid transparent",
            width: "100%",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
            (e.currentTarget as HTMLElement).style.border = "1px solid rgba(239,68,68,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.border = "1px solid transparent";
          }}
        >
          <LogoutIcon />
          ออกจากระบบ
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: "1rem",
          left: "1rem",
          zIndex: 50,
          display: "none",
          padding: "0.5rem",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "0.5rem",
          color: "#f8fafc",
          cursor: "pointer",
        }}
        className="mobile-menu-btn"
        id="mobile-menu-btn"
      >
        <MenuIcon />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: "var(--sidebar-width)",
          minHeight: "100vh",
          background: "linear-gradient(180deg, #080d16 0%, #0c1422 100%)",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: open ? 0 : undefined,
          top: 0,
          bottom: 0,
          zIndex: 45,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          overflowY: "hidden",
        }}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setOpen(false)}
          className="mobile-close-btn"
          style={{
            display: "none",
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: "0.25rem",
          }}
        >
          <CloseIcon />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
