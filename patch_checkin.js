const fs = require('fs');
const file = 'app/api/attendance/checkin/route.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace LATE_GRACE_MINUTES
code = code.replace(
  'const LATE_GRACE_MINUTES = 10;',
  'const envTolerance = parseInt(process.env.ATTENDANCE_TOLERANCE_MINUTES || "10", 10);\n    const LATE_GRACE_MINUTES = Number.isNaN(envTolerance) ? 10 : envTolerance;'
);

// Replace startOfTodayUtc and firstQrSession query
code = code.replace(
  /const startOfTodayUtc = new Date\([\s\S]*?maybeSingle\(\);/m,
  `const startOfTodayWIB = \`\${today}T00:00:00\`;
    const endOfTodayWIB = \`\${today}T23:59:59\`;

    const { data: firstQrSession } = await supabase
      .from("qr_session")
      .select("created_at")
      .gte("created_at", startOfTodayWIB)
      .lte("created_at", endOfTodayWIB)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();`
);

// Replace openingMinutesWIB calculation
const oldCalc = `    // Pastikan created_at diinterpretasikan sebagai UTC meskipun kolomnya \`timestamp without time zone\`
    const openingCreatedStr =
      typeof firstQrSession?.created_at === "string"
        ? firstQrSession.created_at.endsWith("Z")
          ? firstQrSession.created_at
          : firstQrSession.created_at + "Z"
        : null;

    let openingMinutesWIB: number;

    if (openingCreatedStr) {
      // Waktu absen dibuka dalam menit WIB
      const openingWIB = new Date(new Date(openingCreatedStr).getTime() + wibOffset);
      openingMinutesWIB = openingWIB.getUTCHours() * 60 + openingWIB.getUTCMinutes();
    } else {
      // Fallback: jika belum ada QR hari ini, gunakan jam mulai kerja (ATTENDANCE_START_TIME)
      const envStartTime = process.env.ATTENDANCE_START_TIME || "09:00";
      const [startHourStr, startMinStr] = envStartTime.split(":");
      const startHour = parseInt(startHourStr, 10) || 9;
      const startMinute = parseInt(startMinStr, 10) || 0;
      openingMinutesWIB = startHour * 60 + startMinute;
    }`;

const newCalc = `    let openingMinutesWIB: number;

    if (firstQrSession?.created_at) {
      // Waktu absen dibuka dalam menit WIB (karena DB timezone Asia/Jakarta, created_at menyimpan waktu WIB secara literal)
      // Contoh: "2026-08-21T08:15:00"
      const timePart = firstQrSession.created_at.split("T")[1] || "09:00:00";
      const [hh, mm] = timePart.split(":");
      openingMinutesWIB = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    } else {
      // Fallback: jika belum ada QR hari ini, gunakan jam mulai kerja (ATTENDANCE_START_TIME)
      const envStartTime = process.env.ATTENDANCE_START_TIME || "09:00";
      const [startHourStr, startMinStr] = envStartTime.split(":");
      const startHour = parseInt(startHourStr, 10) || 9;
      const startMinute = parseInt(startMinStr, 10) || 0;
      openingMinutesWIB = startHour * 60 + startMinute;
    }`;

code = code.replace(oldCalc, newCalc);

fs.writeFileSync(file, code);
console.log("Done");
