import { readFileSync, writeFileSync } from 'node:fs'
const lock = JSON.parse(readFileSync('package-lock.json'))
const rows = Object.entries(lock.packages).filter(([path]) => path).map(([path, pkg]) => {
  const name = path.split('node_modules/').at(-1)
  return [name, pkg.version, pkg.license ?? 'See upstream package']
}).sort((a,b) => a[0].localeCompare(b[0]))
const unique = [...new Map(rows.map(row => [row.join('|'), row])).values()]
writeFileSync('THIRD_PARTY_NOTICES.md', `# Third-party dependency inventory\n\nOriginal project code is licensed by LICENSE. Dependencies retain their own\nlicenses; this commercial license does not relicense upstream material. This\nsource archive excludes node_modules and compiled bundles. When distributing\nbuild output, preserve the upstream notices and comply with each relevant\nlicense, including attribution/source requirements where applicable. Inspect\nthe installed packages' license files for the full controlling terms.\n\nGenerated from package-lock.json by scripts/third-party-notices.mjs; includes\ndevelopment and platform-specific optional dependencies. Registry package links\nidentify upstream packages, not a grant of additional rights.\n\n| Package | Version | Declared license |\n| --- | --- | --- |\n` + unique.map(([name, version, license]) => `| [${name}](https://www.npmjs.com/package/${name}/v/${version}) | ${version} | ${license} |`).join('\n') + '\n')
