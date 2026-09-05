const ExcelJS = require("exceljs");
const { ensureSchema } = require("../../../lib/db");
const { buildRecap } = require("../../../lib/recap");
const { MATERIALS } = require("../../../lib/materials");
const { getUserFromReq } = require("../../../lib/auth");
const { atLeast } = require("../../../lib/roles");

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FFBFBFBF" } },
  left: { style: "thin", color: { argb: "FFBFBFBF" } },
  bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
  right: { style: "thin", color: { argb: "FFBFBFBF" } },
};

function cellMateriText(hourCell) {
  if (hourCell.total === 0) return "-";
  const entries = Object.entries(hourCell.materials);
  if (entries.length === 1) {
    return `${hourCell.total} (${entries[0][0]})`;
  }
  const rincian = entries.map(([mat, n]) => `${mat}:${n}`).join(", ");
  return `${hourCell.total} (${rincian})`;
}

export default async function handler(req, res) {
  await ensureSchema();
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Belum login" });
  if (!atLeast(user.role, "pengawas")) {
    return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa export Excel" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const shiftId = parseInt(req.query.shiftId, 10);
  if (!shiftId) return res.status(400).json({ error: "shiftId wajib diisi" });

  const recap = await buildRecap(shiftId);
  if (!recap) return res.status(404).json({ error: "Shift tidak ditemukan" });

  const { shift, hours, units, grandTotal, grandMaterialTotals, grandHourlyTotals } = recap;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Aplikasi Ritasi Hauler";
  const sheet = workbook.addWorksheet("Rekap Shift", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  const totalCols = 2 + hours.length + 1; // Unit + Jam.. + Total

  // ---- Header laporan ----
  sheet.mergeCells(1, 1, 1, totalCols);
  sheet.getCell(1, 1).value = "LAPORAN RITASI HAULER";
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.getCell(1, 1).alignment = { horizontal: "center" };

  sheet.mergeCells(2, 1, 2, totalCols);
  sheet.getCell(2, 1).value = shift.label;
  sheet.getCell(2, 1).font = { bold: true, size: 11 };
  sheet.getCell(2, 1).alignment = { horizontal: "center" };

  sheet.mergeCells(3, 1, 3, totalCols);
  const dibukaStr = new Date(shift.opened_at).toLocaleString("id-ID");
  const ditutupStr = shift.closed_at ? new Date(shift.closed_at).toLocaleString("id-ID") : "-";
  sheet.getCell(3, 1).value = `Dibuka: ${dibukaStr}   |   Ditutup: ${ditutupStr}`;
  sheet.getCell(3, 1).alignment = { horizontal: "center" };
  sheet.getCell(3, 1).font = { italic: true, size: 9, color: { argb: "FF666666" } };

  // ---- Header tabel ----
  const headerRowIdx = 5;
  const headerRow = sheet.getRow(headerRowIdx);
  headerRow.getCell(1).value = "Unit";
  hours.forEach((jam, i) => {
    headerRow.getCell(2 + i).value = String(jam).padStart(2, "0");
  });
  headerRow.getCell(2 + hours.length).value = "Total";

  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= totalCols) {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = THIN_BORDER;
    }
  });

  // ---- Baris per unit ----
  units.forEach((u, rowOffset) => {
    const row = sheet.getRow(headerRowIdx + 1 + rowOffset);
    row.getCell(1).value = u.name;
    row.getCell(1).font = { bold: true };
    u.hourly.forEach((h, i) => {
      row.getCell(2 + i).value = cellMateriText(h);
      row.getCell(2 + i).alignment = { horizontal: "center" };
    });
    row.getCell(2 + hours.length).value = u.total;
    row.getCell(2 + hours.length).font = { bold: true };
    row.getCell(2 + hours.length).alignment = { horizontal: "center" };
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= totalCols) cell.border = THIN_BORDER;
    });
  });

  // ---- Baris TOTAL ----
  const totalRowIdx = headerRowIdx + 1 + units.length;
  const totalRow = sheet.getRow(totalRowIdx);
  totalRow.getCell(1).value = "TOTAL";
  grandHourlyTotals.forEach((v, i) => {
    totalRow.getCell(2 + i).value = v;
    totalRow.getCell(2 + i).alignment = { horizontal: "center" };
  });
  totalRow.getCell(2 + hours.length).value = grandTotal;
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber <= totalCols) {
      cell.font = { bold: true };
      cell.fill = TOTAL_FILL;
      cell.border = THIN_BORDER;
    }
  });

  // ---- Rincian material (tabel kedua) ----
  const matHeaderIdx = totalRowIdx + 3;
  sheet.mergeCells(matHeaderIdx - 1, 1, matHeaderIdx - 1, 2 + MATERIALS.length);
  sheet.getCell(matHeaderIdx - 1, 1).value = "RINCIAN MATERIAL PER UNIT";
  sheet.getCell(matHeaderIdx - 1, 1).font = { bold: true, size: 11 };

  const matHeaderRow = sheet.getRow(matHeaderIdx);
  matHeaderRow.getCell(1).value = "Unit";
  matHeaderRow.getCell(2).value = "Total Ritasi";
  MATERIALS.forEach((m, i) => {
    matHeaderRow.getCell(3 + i).value = m;
  });
  matHeaderRow.eachCell((cell, colNumber) => {
    if (colNumber <= 2 + MATERIALS.length) {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: "center" };
      cell.border = THIN_BORDER;
    }
  });

  units.forEach((u, rowOffset) => {
    const row = sheet.getRow(matHeaderIdx + 1 + rowOffset);
    row.getCell(1).value = u.name;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = u.total;
    row.getCell(2).alignment = { horizontal: "center" };
    MATERIALS.forEach((m, i) => {
      row.getCell(3 + i).value = u.materialTotals[m] || 0;
      row.getCell(3 + i).alignment = { horizontal: "center" };
    });
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 2 + MATERIALS.length) cell.border = THIN_BORDER;
    });
  });

  const matTotalRowIdx = matHeaderIdx + 1 + units.length;
  const matTotalRow = sheet.getRow(matTotalRowIdx);
  matTotalRow.getCell(1).value = "TOTAL";
  matTotalRow.getCell(2).value = grandTotal;
  MATERIALS.forEach((m, i) => {
    matTotalRow.getCell(3 + i).value = grandMaterialTotals[m] || 0;
  });
  matTotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber <= 2 + MATERIALS.length) {
      cell.font = { bold: true };
      cell.fill = TOTAL_FILL;
      cell.border = THIN_BORDER;
    }
  });

  // ---- Lebar kolom ----
  sheet.getColumn(1).width = 14;
  for (let i = 2; i <= 2 + hours.length; i++) sheet.getColumn(i).width = 13;

  const tanggalSlug = shift.label.replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = `Ritasi_${tanggalSlug}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const buffer = await workbook.xlsx.writeBuffer();
  return res.status(200).send(Buffer.from(buffer));
}
