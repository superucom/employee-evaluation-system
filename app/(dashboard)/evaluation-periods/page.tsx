"use client";

import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";

interface EvaluationPeriod {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  expectedWorkingDays: number;
  status: "DRAFT" | "ACTIVE" | "LOCKED" | "CLOSED";
  createdAt: string;
  _count?: { evaluationRecords: number };
}

export default function EvaluationPeriodsPage() {
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "MONTHLY",
    startDate: "",
    endDate: "",
    expectedWorkingDays: 20,
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/evaluation-periods");
      const data = await res.json();
      if (res.ok) setPeriods(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/evaluation-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "เกิดข้อผิดพลาดในการสร้างรอบการประเมิน");
        return;
      }

      setShowModal(false);
      setFormData({
        name: "",
        type: "MONTHLY",
        startDate: "",
        endDate: "",
        expectedWorkingDays: 20,
      });
      fetchPeriods();
    } catch {
      setFormError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (period: EvaluationPeriod, newStatus: string) => {
    const actionText = newStatus === "LOCKED" ? "ล็อก (ห้ามแก้ไขผลการประเมิน)" : newStatus === "ACTIVE" ? "เปิดใช้งาน" : "เปลี่ยนสถานะ";
    if (!confirm(`คุณต้องการ${actionText} รอบการประเมิน "${period.name}" หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/evaluation-periods/${period.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchPeriods();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">รอบการประเมิน (Evaluation Periods)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            สร้างและจัดการรอบการประเมินผลการปฏิบัติงาน กำหนดวันทำงานที่คาดหวัง และล็อกรอบการประเมินเมื่อสรุปผล
          </p>
        </div>
        <button
          onClick={() => {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

            setFormData({
              name: `รอบประจำเดือน ${today.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}`,
              type: "MONTHLY",
              startDate: firstDay,
              endDate: lastDay,
              expectedWorkingDays: 20,
            });
            setFormError("");
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm text-sm"
        >
          + สร้างรอบการประเมินใหม่
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูลรอบการประเมิน...</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">ยังไม่มีรอบการประเมินในระบบ</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {periods.map((p) => (
            <div
              key={p.id}
              className={`bg-card rounded-2xl border p-6 shadow-sm flex flex-col justify-between transition-all ${
                p.status === "ACTIVE"
                  ? "border-primary shadow-md ring-1 ring-primary/20"
                  : p.status === "LOCKED"
                  ? "border-red-200 bg-red-50/10"
                  : "border-border"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-border pb-3 mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{p.name}</h2>
                    <span className="text-xs text-muted-foreground capitalize">ประเภท: {p.type}</span>
                  </div>
                  <div>
                    <span
                      className={
                        p.status === "ACTIVE"
                          ? "badge-active"
                          : p.status === "LOCKED"
                          ? "badge-locked"
                          : "badge-draft"
                      }
                    >
                      {p.status === "ACTIVE"
                        ? "กำลังใช้งาน"
                        : p.status === "LOCKED"
                        ? "ล็อกแล้ว"
                        : "ฉบับร่าง"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>ช่วงเวลา:</span>
                    <span className="font-medium text-foreground">
                      {formatDate(p.startDate)} - {formatDate(p.endDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>วันทำงานที่คาดหวัง:</span>
                    <span className="font-bold text-foreground">{p.expectedWorkingDays} วัน</span>
                  </div>
                  <div className="flex justify-between">
                    <span>จำนวนการประเมินที่ส่งแล้ว:</span>
                    <span className="font-semibold text-primary">{p._count?.evaluationRecords || 0} รายการ</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                <div className="flex gap-2">
                  {p.status === "DRAFT" && (
                    <button
                      onClick={() => handleToggleStatus(p, "ACTIVE")}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold"
                    >
                      เปิดใช้งาน (Activate)
                    </button>
                  )}
                  {p.status === "ACTIVE" && (
                    <button
                      onClick={() => handleToggleStatus(p, "LOCKED")}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                    >
                      🔒 ล็อกรอบประเมิน (Lock)
                    </button>
                  )}
                  {p.status === "LOCKED" && (
                    <button
                      onClick={() => handleToggleStatus(p, "ACTIVE")}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                    >
                      🔓 ปลดล็อก (Unlock)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Period Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl p-6 space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold">สร้างรอบการประเมินใหม่</h2>
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ชื่อรอบการประเมิน *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สิงหาคม 2026, Q3/2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ประเภท</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                >
                  <option value="MONTHLY">รายเดือน (Monthly)</option>
                  <option value="DAILY">รายวัน (Daily)</option>
                  <option value="QUARTERLY">รายไตรมาส (Quarterly)</option>
                  <option value="ANNUAL">รายปี (Annual)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">วันเริ่มต้น *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">วันสิ้นสุด *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">จำนวนวันทำงานที่คาดหวัง (Expected Working Days) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={31}
                  value={formData.expectedWorkingDays}
                  onChange={(e) => setFormData({ ...formData, expectedWorkingDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm font-bold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ใช้สำหรับคำนวณอัตราความสำเร็จ (Completion Rate) = ประเมินแล้ว / คาดหวัง × 100
                </p>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "กำลังสร้าง..." : "สร้างรอบประเมิน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
