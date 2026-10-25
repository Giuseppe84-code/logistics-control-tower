import { it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { unzipSync } from 'fflate'
// @ts-expect-error Plain Node release tooling is exercised directly.
import { makeArchive, validateFile } from '../scripts/package-release.mjs'

it('packages a pinned tree reproducibly, excludes local secrets and seller files, and checks versions', () => {
  const root = mkdtempSync(join(tmpdir(), 'lct-packaging-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  try {
    git('init', '-q'); git('config', 'user.name', 'Release test'); git('config', 'user.email', 'test@example.invalid')
    writeFileSync(join(root, 'release.manifest.json'), JSON.stringify({ directories: ['src'], files: ['package.json', 'package-lock.json', '.env.example'] }))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '1.0.0', packages: { '': { version: '1.0.0' } } }))
    writeFileSync(join(root, '.env.example'), 'PUBLIC_URL=\n')
    writeFileSync(join(root, 'GUMROAD_LISTING.md'), 'seller only')
    mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src/app.ts'), 'export const x = 1')
    git('add', '.'); git('commit', '-qm', 'fixture')
    writeFileSync(join(root, '.env.local'), 'must never ship')
    const first = makeArchive(root, 'HEAD'), second = makeArchive(root, 'HEAD')
    expect(first.bytes).toEqual(second.bytes)
    const names = Object.keys(unzipSync(first.bytes))
    expect(names).not.toContain('logistics-control-tower/GUMROAD_LISTING.md')
    expect(names.some(name => name.includes('.git/') || name.includes('.env.local'))).toBe(false)
    expect(names).toContain('logistics-control-tower/RELEASE.json')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '2.0.0' })); git('add', '.'); git('commit', '-qm', 'mismatch')
    expect(() => makeArchive(root, 'HEAD')).toThrow(/Version mismatch/)
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    symlinkSync('../.env.local', join(root, 'src/link')); git('add', '.'); git('commit', '-qm', 'symlink')
    expect(() => makeArchive(root, 'HEAD')).toThrow(/Unsupported entry/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
it('rejects accidentally selected secret files and realistic credential patterns', () => {
  expect(() => validateFile('.env.production', Buffer.from(''))).toThrow(/Sensitive/)
  expect(() => validateFile('.env.example', Buffer.from('PUBLIC_URL=https://configured.invalid'))).toThrow(/empty/)
  const syntheticKey = ['sk', 'live', 'X'.repeat(24)].join('_')
  expect(() => validateFile('src/config.ts', Buffer.from(syntheticKey))).toThrow(/Possible secret/)
})
