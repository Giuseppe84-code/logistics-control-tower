import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { unzipSync } from 'fflate'
import { digest, validateFile, verifyArchiveIdentity } from './package-release.mjs'

const zip = process.argv[2]
if (!zip) throw Error('Usage: npm run verify:archive -- PATH.zip')
const args = process.argv.slice(3)
const options = {}
for (let i = 0; i < args.length; i += 2) {
  if (!['--expected-commit', '--expected-sha256'].includes(args[i]) || !args[i + 1] || options[args[i]] !== undefined) throw Error('Invalid archive verification options')
  options[args[i]] = args[i + 1]
}
const bytes = readFileSync(zip)
// Reject a substituted ZIP before parsing, extraction or dependency installation.
verifyArchiveIdentity(bytes, {}, undefined, options['--expected-sha256'])
const entries = unzipSync(bytes), prefix = 'logistics-control-tower/'
const metadata = JSON.parse(Buffer.from(entries[prefix + 'RELEASE.json']).toString())
verifyArchiveIdentity(bytes, metadata, options['--expected-commit'])
if (!/^[a-f0-9]{40}$/.test(metadata.commit)) throw Error('Missing source commit')
if (Object.keys(entries).length !== Object.keys(metadata.files).length + 1) throw Error('Unexpected archive contents')
const temporary = mkdtempSync(join(tmpdir(), 'lct-archive-'))
try {
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.startsWith(prefix)) throw Error('Invalid archive root')
    const path = name.slice(prefix.length); validateFile(path, bytes)
    if (path !== 'RELEASE.json' && metadata.files[path] !== digest(bytes)) throw Error(`Checksum mismatch: ${path}`)
    const output = join(temporary, path); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, bytes)
  }
  const packageJson = JSON.parse(readFileSync(join(temporary, 'package.json')))
  if (packageJson.version !== metadata.version) throw Error('Metadata version mismatch')
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: temporary, stdio: 'inherit' })
  execFileSync('npm', ['run', 'check'], {
    cwd: temporary, stdio: 'inherit',
    env: { ...process.env, DENO_DIR: join(temporary, '.deno-cache') },
  })
  console.log(`Clean archive verified: ${metadata.version} at ${metadata.commit}`)
} finally { rmSync(temporary, { recursive: true, force: true }) }
