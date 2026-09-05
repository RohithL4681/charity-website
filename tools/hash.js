// Usage: node tools/hash.js <your-password>
// Prints the SHA-256 hash to paste into src/_data/site.json -> admin.passwordHash
const crypto = require('crypto');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node tools/hash.js <your-password>');
  process.exit(1);
}
console.log(crypto.createHash('sha256').update(password, 'utf8').digest('hex'));