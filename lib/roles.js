// Hierarki role: makin tinggi angkanya, makin luas wewenangnya.
// superadmin (4) > admin (3) > pengawas (2) > operator (1)
const ROLE_LEVEL = {
  superadmin: 4,
  admin: 3,
  pengawas: 2,
  operator: 1,
};

const ALL_ROLES = Object.keys(ROLE_LEVEL);

function levelOf(role) {
  return ROLE_LEVEL[role] || 0;
}

// True kalau role user >= role minimum yang dibutuhkan.
// Contoh: atLeast("pengawas", "pengawas") -> true, atLeast("operator", "pengawas") -> false
function atLeast(role, minRole) {
  return levelOf(role) >= levelOf(minRole);
}

const ROLE_LABEL = {
  superadmin: "Superadmin",
  admin: "Admin",
  pengawas: "Pengawas",
  operator: "Operator",
};

module.exports = { ROLE_LEVEL, ALL_ROLES, ROLE_LABEL, levelOf, atLeast };
