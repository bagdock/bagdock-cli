#!/usr/bin/env node
// Render the Homebrew formula for @bagdock/cli — pure template fill, no
// network/git (mirrors the style of bagdock/bagdock's
// scripts/mirror/assemble-mirror.mjs). Consumed by
// .github/workflows/homebrew-sync.yml, which resolves the version, npm
// tarball URL, and sha256 and passes them in here.
//
// BDOK-1232 (formalize bagdock/homebrew-cli as a generated release mirror),
// pairs with BDOK-1227.
//
// Usage:
//   node scripts/render-homebrew-formula.mjs \
//     --version <bare semver> --url <npm tarball URL> --sha256 <64-hex> --out <path>

import { writeFileSync } from 'node:fs'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i]
  }
  return args
}

function die(msg) {
  console.error(`render-homebrew-formula: ${msg}`)
  process.exit(1)
}

const args = parseArgs(process.argv.slice(2))
const version = args.version || die('missing --version')
const url = args.url || die('missing --url')
const sha256 = args.sha256 || die('missing --sha256')
const outPath = args.out || die('missing --out')

if (!/^\d+\.\d+\.\d+$/.test(version)) die(`--version must be a bare semver (got ${JSON.stringify(version)})`)
if (!/^https:\/\/registry\.npmjs\.org\//.test(url)) die(`--url must be an npm registry tarball URL (got ${JSON.stringify(url)})`)
if (!/^[0-9a-f]{64}$/.test(sha256)) die(`--sha256 must be a 64-char lowercase hex digest (got ${JSON.stringify(sha256)})`)

// depends_on "node" (unversioned): current Homebrew guidance is to declare a
// versioned Node dependency only when upstream requires an exact/older
// release. @bagdock/cli requires Node 20+, which the always-current `node`
// formula satisfies. Verified against
// https://github.com/Homebrew/brew/blob/HEAD/docs/Language-Specific-Formulae.md
// ("Standard npm installation") and
// https://github.com/Homebrew/brew/blob/HEAD/docs/Checksum-Requirements.md
// (sha256 mandatory, including in custom taps), 2026-09-06.
const formula = `class Bagdock < Formula
  desc "Bagdock developer CLI — build, test, and deploy apps and edges"
  homepage "https://github.com/bagdock/bagdock-cli"
  url "${url}"
  version "${version}"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/bagdock"
  end

  test do
    assert_match "${version}", shell_output("#{bin}/bagdock --version")
  end
end
`

writeFileSync(outPath, formula)
console.log(`render-homebrew-formula: wrote ${outPath} (v${version})`)
