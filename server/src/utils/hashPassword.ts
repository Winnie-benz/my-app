/**
 * Utility script — generate a bcrypt hash for a plain-text password.
 *
 * Usage:
 *   npx ts-node src/utils/hashPassword.ts <your-password>
 *
 * Then paste the output into the password_hash column in your Google Sheet.
 */
import bcrypt from 'bcryptjs'

const password = process.argv[2]

if (!password) {
  console.error('Usage: npx ts-node src/utils/hashPassword.ts <password>')
  process.exit(1)
}

bcrypt.hash(password, 12).then(hash => {
  console.log('\nPassword hash (copy this into Google Sheets → password_hash column):')
  console.log(hash)
})
