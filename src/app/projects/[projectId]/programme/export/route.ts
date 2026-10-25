import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getProgramme } from "@/lib/data/programme";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAVY = "FF1F3864";
const BLUE = "FFDDE6F2";
const CONF = "FFFFF9E6";
const CMF = "FFE8F1FB";

function headerRow(ws: ExcelJS.Worksheet, cells: string[], fill = NAVY, color = "FFFFFFFF") {
  const row = ws.addRow(cells);
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: color }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  return row;
}

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const membership = await getMembershipForProject(params.projectId);
  if (!membership) return new NextResponse("Forbidden", { status: 403 });

  const data = await getProgramme(params.projectId);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "CMS";
  wb.created = new Date();

  // ── Sheet 1: Programme ──────────────────────────────────────────────
  const ws = wb.addWorksheet("Programme");
  ws.columns = [
    { width: 46 }, { width: 12 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 18 }, { width: 30 },
  ];
  headerRow(ws, [
    "Inspection", "Type",
    "Planned insp.", "Actual insp.", "Completion",
    "CM check date", "Result", "Remarks",
  ]);
  for (const p of data.phases) {
    const ph = ws.addRow([
      `${p.code} · ${p.name}${p.plannedStart ? `   (${p.plannedStart} → ${p.plannedEnd})` : ""}`,
    ]);
    ws.mergeCells(ph.number, 1, ph.number, 8);
    ph.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ph.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    for (const a of p.activities) {
      const ar = ws.addRow([a.title]);
      ws.mergeCells(ar.number, 1, ar.number, 8);
      ar.getCell(1).font = { bold: true, color: { argb: "FF1F3864" } };
      ar.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      for (const r of a.rows) {
        const row = ws.addRow([
          `${r.code} · ${r.name}`,
          r.pointType,
          r.plannedDate ?? "",
          r.actualDate ?? "",
          r.completionDate ?? "",
          r.cmCheckDate ?? "",
          r.result ?? "",
          r.remarks ?? "",
        ]);
        [3, 4, 5].forEach((i) => (row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CONF } }));
        [6, 7, 8].forEach((i) => (row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CMF } }));
      }
    }
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Sheet 2: Elements ───────────────────────────────────────────────
  const es = wb.addWorksheet("Elements");
  es.columns = [
    { width: 12 }, { width: 14 }, { width: 22 }, { width: 10 },
    { width: 14 }, { width: 28 }, { width: 14 }, { width: 28 },
  ];
  headerRow(es, [
    "Element", "Type", "Label", "Inspection",
    "Contractor result", "Contractor remark", "CM result", "CM remark",
  ]);
  for (const p of data.phases)
    for (const a of p.activities)
      for (const r of a.rows)
        for (const el of r.elements) {
          const row = es.addRow([
            el.elementId,
            el.elementType ?? "",
            `${el.label ?? ""}${el.qty > 1 ? ` ×${el.qty}` : ""}`,
            r.code,
            el.contractorResult ?? "",
            el.contractorRemarks ?? "",
            el.cmResult ?? "",
            el.cmRemarks ?? "",
          ]);
          [5, 6].forEach((i) => (row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CONF } }));
          [7, 8].forEach((i) => (row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CMF } }));
        }
  es.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = data.projectName.replace(/[^A-Za-z0-9]+/g, "-");
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}-Programme-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
