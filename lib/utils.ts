import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD sesuai timezone WIB (UTC+7).
 * Berguna untuk UI date input & filter tanggal di server maupun client.
 */
export function getTodayWIB(): string {
  const nowUtc = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUtc.getTime() + wibOffset);
  return nowWIB.toISOString().split("T")[0];
}
