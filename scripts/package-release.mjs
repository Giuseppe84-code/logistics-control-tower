import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { zipSync } from 'fflate'

export const digest = value => createHash('sha256').update(value).digest('hex')
// Expectations must come from a separately approved record, never the ZIP itself.
export function verifyArchiveIdentity(bytes, metadata, expectedCommit, expectedSha256) {
  if (expectedCommit !== undefined && (!/^[a-f0-9]{40}$/.test(expectedCommit) || metadata.commit !== expectedCommit)) throw Error('Approved source commit mismatch')
  if (expectedSha256 !== undefined && (!/^[a-f0-9]{64}$/.test(expectedSha256) || digest(bytes) !== expectedSha256)) throw Error('Approved ZIP checksum mismatch')
}
export function validateFile(path, bytes) {
  if (/[\x00-\x1f\x7f]/.test(path) || path.split('/').some(p => ['..', '.git', 'node_modules', 'dist', '.temp'].includes(p)) || path.startsWith('/') || path.includes('\\')) throw Error(`Forbidden path: ${path}`)
  if ((/(^|\/)\.env/.test(path) && path !== '.env.example') || /\.(pem|key|p12|pfx|sqlite|db|log|zip)$/i.test(path) || path === 'GUMROAD_LISTING.md') throw Error(`Sensitive file: ${path}`)
  if (path.endsWith('.png')) return
  const text = Buffer.from(bytes).toString('utf8')
  const patterns = [/\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/, /\bwhsec_[A-Za-z0-9]{16,}/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bre_[A-Za-z0-9]{20,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/]
  if (patterns.some(pattern => pattern.test(text))) throw Error(`Possible secret in ${path}; review privately`)
  if (path === '.env.example' && text.split('\n').some(line => /^[A-Z][A-Z0-9_]*=.+/.test(line))) throw Error('Example environment must have empty values')
}
export function makeArchive(root, ref) {
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 10 * 1024 * 1024 })
  const commit = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).toString().trim()
  const manifest = JSON.parse(git(['show', `${commit}:release.manifest.json`]).toString())
  const entries = git(['ls-tree', '-rz', commit]).toString().split('\0').filter(Boolean)
  const files = {}
  for (const entry of entries) {
    const separator = entry.indexOf('\t')
    const meta = entry.slice(0, separator), path = entry.slice(separator + 1), [mode, type, blob] = meta.split(' ')
    if (!manifest.files.includes(path) && !manifest.directories.some(dir => path.startsWith(`${dir}/`))) continue
    if (mode !== '100644' && mode !== '100755' || type !== 'blob') throw Error(`Unsupported entry: ${path}`)
    const bytes = git(['cat-file', 'blob', blob]); validateFile(path, bytes); files[path] = bytes
  }
  for (const path of manifest.files) if (!files[path]) throw Error(`Required file missing: ${path}`)
  const pkg = JSON.parse(files['package.json']), lock = JSON.parse(files['package-lock.json'])
  if (pkg.version !== lock.version || pkg.version !== lock.packages[''].version) throw Error('Version mismatch')
  const hashes = Object.fromEntries(Object.keys(files).sort().map(path => [path, digest(files[path])]))
  files['RELEASE.json'] = Buffer.from(JSON.stringify({ version: pkg.version, commit, files: hashes }, null, 2) + '\n')
  // ZIP stores local calendar fields without a timezone. Construct local midnight
  // so machines in different timezones write identical, valid DOS timestamps.
  const content = Object.fromEntries(Object.keys(files).sort().map(path => [`logistics-control-tower/${path}`, [files[path], { mtime: new Date(1980, 0, 1, 0, 0, 0), os: 3, attrs: 0o100644 << 16 }]]))
  return { bytes: zipSync(content, { level: 9 }), version: pkg.version, commit }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), ref = args[args.indexOf('--ref') + 1]
  if (!args.includes('--ref') || !ref) throw Error('Usage: npm run package:release -- --ref COMMIT')
  if (execFileSync('git', ['status', '--porcelain']).toString().trim()) throw Error('Commit changes first; release checkout must be clean')
  const result = makeArchive(process.cwd(), ref)
  mkdirSync('release', { recursive: true })
  const name = `logistics-control-tower-${result.version}.zip`
  writeFileSync(`release/${name}`, result.bytes)
  writeFileSync(`release/${name}.sha256`, `${digest(result.bytes)}  ${name}\n`)
  console.log(`Created ${name} from ${result.commit}; SHA-256 ${digest(result.bytes)}`)
}
