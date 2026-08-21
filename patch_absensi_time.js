const fs = require('fs');

const file1 = 'app/api/attendance/checkin/route.ts';
let code1 = fs.readFileSync(file1, 'utf8');
code1 = code1.replace('const jam_masuk = nowUtc.toISOString();', 'const jam_masuk = nowWIB.toISOString().slice(0, 19);');
fs.writeFileSync(file1, code1);

const file2 = 'app/api/attendance/checkout/route.ts';
let code2 = fs.readFileSync(file2, 'utf8');
code2 = code2.replace('jam_pulang: nowUtc.toISOString(),', 'jam_pulang: nowWIB.toISOString().slice(0, 19),');
fs.writeFileSync(file2, code2);

console.log("Done absensi time");
