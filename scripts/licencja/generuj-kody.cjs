const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function addMonths(yyyyMm, shift) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + shift);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function randomCode8() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 8; i++) {
    value += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return value;
}

function uniqueCode(existing) {
  let code = randomCode8();
  while (existing.has(code)) {
    code = randomCode8();
  }
  existing.add(code);
  return code;
}

const machineId = getArg('machine-id');
const months = Number(getArg('months', '120'));
const start = getArg('start', '2026-03');
const privateKeyPath = getArg('private-key', path.join(process.cwd(), 'licencja', 'private-key.pem'));
const outDir = getArg('out-dir', path.join(process.cwd(), 'licencja'));

if (!machineId) {
  console.error('Brak parametru --machine-id');
  process.exit(1);
}

if (!/^\d{4}-\d{2}$/.test(start)) {
  console.error('Parametr --start musi mieć format YYYY-MM');
  process.exit(1);
}

if (!Number.isInteger(months) || months <= 0) {
  console.error('Parametr --months musi być dodatnią liczbą całkowitą');
  process.exit(1);
}

if (!fs.existsSync(privateKeyPath)) {
  console.error(`Nie znaleziono klucza prywatnego: ${privateKeyPath}`);
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const used = new Set();
const monthlyCodes = {};
const lines = [];

for (let i = 0; i < months; i++) {
  const monthKey = addMonths(start, i);
  const code = uniqueCode(used);
  monthlyCodes[monthKey] = code;
  lines.push(`${monthKey}: ${code}`);
}

const payload = {
  machineId,
  generatedAt: new Date().toISOString(),
  startMonth: start,
  months,
  monthlyCodes,
};

const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
const signature = crypto.sign(
  'sha256',
  Buffer.from(JSON.stringify(payload), 'utf8'),
  {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  },
).toString('base64');

const bundle = { payload, signature };

const bundlePath = path.join(outDir, 'bundle.json');
const codesPath = path.join(outDir, 'kody-miesieczne.txt');
const usedCodesPath = path.join(outDir, 'used-codes.json');
const activeLicensePath = path.join(outDir, 'active-license.json');

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');
fs.writeFileSync(codesPath, lines.join('\n') + '\n', 'utf8');
fs.writeFileSync(usedCodesPath, JSON.stringify({ usedCodeHashes: [], updatedAt: null }, null, 2), 'utf8');
fs.writeFileSync(activeLicensePath, JSON.stringify({ activeMonth: null, activatedAt: null, codeHash: null }, null, 2), 'utf8');

console.log('Wygenerowano paczkę licencji:');
console.log(bundlePath);
console.log('Wygenerowano listę kodów:');
console.log(codesPath);
console.log('Łącznie kodów:', months);
console.log('Pierwsze 5 kodów:');
lines.slice(0, 5).forEach((line) => console.log(`- ${line}`));
