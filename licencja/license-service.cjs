const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LICENSE_DIR = path.join(__dirname);
const BUNDLE_PATH = path.join(LICENSE_DIR, 'bundle.json');
const PUBLIC_KEY_PATH = path.join(LICENSE_DIR, 'public-key.pem');
const USED_CODES_PATH = path.join(LICENSE_DIR, 'used-codes.json');
const ACTIVE_LICENSE_PATH = path.join(LICENSE_DIR, 'active-license.json');

function ensureJsonFile(filePath, fallbackData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2), 'utf8');
  }
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getMachineId() {
  const candidates = [
    '/etc/machine-id',
    '/var/lib/dbus/machine-id',
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const value = fs.readFileSync(candidate, 'utf8').trim();
        if (value) return value;
      }
    } catch {
      // ignore and fallback
    }
  }

  const fallback = `${require('os').hostname()}::${process.platform}::${process.arch}`;
  return crypto.createHash('sha256').update(fallback).digest('hex');
}

function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getDueDateLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `01.${month}.${year}`;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
}

function normalizeCode(rawCode) {
  return String(rawCode || '').trim();
}

function validateCodeFormat(code) {
  return /^[A-Za-z0-9]{8}$/.test(code);
}

function verifyBundleSignature(bundle) {
  if (!bundle || typeof bundle !== 'object' || !bundle.payload || !bundle.signature) {
    throw new Error('Niepoprawny format bundle.json');
  }

  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    throw new Error('Brak klucza publicznego licencji (public-key.pem)');
  }

  const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
  const isValid = crypto.verify(
    'sha256',
    Buffer.from(JSON.stringify(bundle.payload), 'utf8'),
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    Buffer.from(bundle.signature, 'base64'),
  );

  if (!isValid) {
    throw new Error('Niepoprawny podpis bundle.json');
  }
}

function ensureLicenseFiles() {
  ensureJsonFile(USED_CODES_PATH, { usedCodeHashes: [], updatedAt: null });
  ensureJsonFile(ACTIVE_LICENSE_PATH, { activeMonth: null, activatedAt: null, codeHash: null });
}

function loadBundleAndValidate() {
  if (!fs.existsSync(BUNDLE_PATH)) {
    throw new Error('Brak pliku licencji bundle.json');
  }

  const bundle = loadJson(BUNDLE_PATH);
  verifyBundleSignature(bundle);

  const currentMachineId = getMachineId();
  if (bundle.payload.machineId !== currentMachineId) {
    throw new Error('Bundle licencyjny nie pasuje do tego urządzenia');
  }

  return bundle;
}

function getLicenseStatus(now = new Date()) {
  ensureLicenseFiles();

  const bundle = loadBundleAndValidate();
  const monthKey = getMonthKey(now);
  const expectedCode = bundle.payload.monthlyCodes?.[monthKey];

  if (!expectedCode) {
    return {
      ok: true,
      locked: true,
      monthKey,
      dueDateLabel: getDueDateLabel(now),
      reason: 'Brak kodu dla bieżącego miesiąca',
      activatedAt: null,
    };
  }

  const active = loadJson(ACTIVE_LICENSE_PATH);
  const isUnlocked = active.activeMonth === monthKey;

  return {
    ok: true,
    locked: !isUnlocked,
    monthKey,
    dueDateLabel: getDueDateLabel(now),
    reason: isUnlocked ? null : 'Wymagany nowy kod na ten miesiąc',
    activatedAt: isUnlocked ? active.activatedAt : null,
  };
}

function activateCode(rawCode, now = new Date()) {
  ensureLicenseFiles();

  const code = normalizeCode(rawCode);
  if (!validateCodeFormat(code)) {
    return {
      ok: false,
      message: 'Kod musi mieć dokładnie 8 znaków (A-Z, a-z, 0-9).',
    };
  }

  const bundle = loadBundleAndValidate();
  const monthKey = getMonthKey(now);
  const expectedCode = bundle.payload.monthlyCodes?.[monthKey];

  if (!expectedCode) {
    return {
      ok: false,
      message: `Brak wygenerowanego kodu dla miesiąca ${monthKey}.`,
    };
  }

  if (code !== expectedCode) {
    return {
      ok: false,
      message: 'Niepoprawny kod licencyjny dla bieżącego miesiąca.',
    };
  }

  const codeHash = hashCode(code);
  const usedCodes = loadJson(USED_CODES_PATH);
  const usedSet = new Set(usedCodes.usedCodeHashes || []);

  if (usedSet.has(codeHash)) {
    return {
      ok: false,
      message: 'Ten kod był już użyty i nie może być użyty ponownie.',
    };
  }

  usedSet.add(codeHash);
  saveJson(USED_CODES_PATH, {
    usedCodeHashes: Array.from(usedSet),
    updatedAt: new Date().toISOString(),
  });

  saveJson(ACTIVE_LICENSE_PATH, {
    activeMonth: monthKey,
    activatedAt: new Date().toISOString(),
    codeHash,
  });

  return {
    ok: true,
    monthKey,
    message: 'Licencja aktywowana poprawnie.',
  };
}

module.exports = {
  getMachineId,
  getMonthKey,
  getDueDateLabel,
  getLicenseStatus,
  activateCode,
  validateCodeFormat,
};
