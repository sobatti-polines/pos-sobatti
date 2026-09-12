export const DEV_ROLE = "DEV";
export const OWNER_ROLE = "OWNER";
export const ADMIN_ROLE = "ADMIN";
export const KASIR_ROLE = "KASIR";
export const KARYAWAN_ROLE = "KARYAWAN";
export const CONTRACT_ROLE = "KONTRAK";

export const USER_MANAGED_ROLES = [KARYAWAN_ROLE, CONTRACT_ROLE, KASIR_ROLE, ADMIN_ROLE, OWNER_ROLE] as const;
export const OPERATIONAL_EMPLOYEE_ROLES = [ADMIN_ROLE, KASIR_ROLE, KARYAWAN_ROLE, CONTRACT_ROLE] as const;

export const ROLE_LABELS: Record<string, string> = {
  [DEV_ROLE]: "Developer",
  [OWNER_ROLE]: "Pemilik",
  [ADMIN_ROLE]: "Admin",
  [KASIR_ROLE]: "Kasir",
  [KARYAWAN_ROLE]: "Karyawan",
  [CONTRACT_ROLE]: "Pegawai Kontrak",
};

export function isDev(role?: string | null) {
  return role === DEV_ROLE;
}

export function isOwnerLike(role?: string | null) {
  return role === OWNER_ROLE || role === DEV_ROLE;
}

export function isAdminOrOwnerLike(role?: string | null) {
  return role === ADMIN_ROLE || isOwnerLike(role);
}

export function isManagementRole(role?: string | null) {
  return isAdminOrOwnerLike(role);
}

export function isStaffRole(role?: string | null) {
  return isOperationalEmployeeRole(role);
}

export function isAttendanceOnlyRole(role?: string | null) {
  return role === KARYAWAN_ROLE || role === CONTRACT_ROLE;
}

export function canBookLeaveForRole(role?: string | null) {
  return isOperationalEmployeeRole(role) && role !== CONTRACT_ROLE;
}

export function isAttendanceExemptRole(role?: string | null) {
  return isOwnerLike(role);
}

export function canManageDevRole(role?: string | null) {
  return isDev(role);
}

export function isUserManagedRole(role?: string | null) {
  return USER_MANAGED_ROLES.includes(role as (typeof USER_MANAGED_ROLES)[number]);
}

export function isOperationalEmployeeRole(role?: string | null) {
  return OPERATIONAL_EMPLOYEE_ROLES.includes(role as (typeof OPERATIONAL_EMPLOYEE_ROLES)[number]);
}
