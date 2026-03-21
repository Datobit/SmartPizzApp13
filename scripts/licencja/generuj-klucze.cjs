const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir = path.join(process.cwd(), 'licencja');
const privateKeyPath = path.join(outDir, 'private-key.pem');
const publicKeyPath = path.join(outDir, 'public-key.pem');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
  console.error('Klucze już istnieją. Usuń je ręcznie jeśli chcesz wygenerować nowe.');
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
fs.writeFileSync(publicKeyPath, publicKey, 'utf8');

console.log('Wygenerowano klucze RSA:');
console.log(`- prywatny: ${privateKeyPath}`);
console.log(`- publiczny: ${publicKeyPath}`);
