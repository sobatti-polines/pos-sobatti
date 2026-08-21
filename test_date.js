const wibOffset = 7 * 60 * 60 * 1000;
const nowUtc = Date.now();
const nowWIB = new Date(nowUtc + wibOffset);
const todayStr = nowWIB.toISOString().slice(0, 10);
const todayStart = new Date(todayStr + "T00:00:00+07:00");

console.log("nowUtc:", new Date(nowUtc).toISOString());
console.log("nowWIB:", nowWIB.toISOString());
console.log("todayStr:", todayStr);
console.log("todayStart:", todayStart.toISOString());
