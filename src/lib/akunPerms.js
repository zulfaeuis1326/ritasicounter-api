import { ROLES } from "@/lib/roles";

// Aturan siapa boleh mengelola siapa. Cermin dari pengecekan di
// src/pages/api/admin/operators.js -- API tetap penjaga utama, ini cuma
// supaya tombol yang pasti ditolak server tidak ditampilkan.
export function canTouch(actor, target) {
  if (!actor || actor.id === target.id) return false;
  if (actor.role === "superadmin") return true;
  if (actor.role === "admin") return target.role !== "admin" && target.role !== "superadmin";
  return false;
}

// Role yang boleh dijadikan tujuan perubahan role.
export function roleOptions(actor, target) {
  if (!canTouch(actor, target) || target.role === "superadmin") return [];
  const pool = actor.role === "superadmin" ? ROLES : ["operator", "pengawas"];
  return pool.filter((r) => r !== target.role);
}
