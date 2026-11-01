// Tingkatan role, dari terendah ke tertinggi.
export const ROLES = ["operator", "pengawas", "admin", "superadmin"];

export const ROLE_LABEL = {
  operator: "Operator",
  pengawas: "Pengawas",
  admin: "Admin",
  superadmin: "Superadmin",
};

// true kalau role user setara atau lebih tinggi dari role minimum.
// Role tidak dikenal (atau kosong) dianggap tidak punya akses.
export function atLeast(role, minRole) {
  const a = ROLES.indexOf(role);
  const b = ROLES.indexOf(minRole);
  if (a === -1 || b === -1) return false;
  return a >= b;
}
