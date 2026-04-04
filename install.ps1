# Bagdock CLI installer for Windows
# Usage: irm https://bdok.dev/install.ps1 | iex
#
# Respects BAGDOCK_INSTALL env var for custom install dir (default: ~/.bagdock/bin)

$ErrorActionPreference = "Stop"

$InstallDir = if ($env:BAGDOCK_INSTALL) { $env:BAGDOCK_INSTALL } else { Join-Path $HOME ".bagdock\bin" }
$Package = "@bagdock/cli"

function Write-Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Err($msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

function Test-NodeVersion {
    if (-not (Test-Command "node")) {
        Write-Err "Node.js is required. Install from https://nodejs.org (v20+)"
    }
    if (-not (Test-Command "npm")) {
        Write-Err "npm is required. Install Node.js from https://nodejs.org (v20+)"
    }

    $version = node -e "console.log(process.versions.node.split('.')[0])"
    if ([int]$version -lt 20) {
        Write-Err "Node.js 20+ required (found v$version). Update at https://nodejs.org"
    }
}

function Install-ViaNpm {
    Write-Info "Installing $Package globally..."
    npm install -g $Package
    if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed" }
}

function Install-ToDir {
    Write-Info "Installing $Package to $InstallDir..."

    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "bagdock-install-$([guid]::NewGuid())"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        Push-Location $tmpDir
        npm pack $Package --quiet 2>$null
        $tarball = Get-ChildItem -Filter "*.tgz" | Select-Object -First 1
        tar xzf $tarball.FullName

        Copy-Item "package\dist\bagdock.js" (Join-Path $InstallDir "bagdock.js") -Force

        $batContent = "@echo off`r`nnode `"%~dp0bagdock.js`" %*"
        Set-Content -Path (Join-Path $InstallDir "bagdock.cmd") -Value $batContent

        Pop-Location
    }
    finally {
        Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
    }

    Add-ToPath
}

function Add-ToPath {
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($currentPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$InstallDir;$currentPath", "User")
        $env:PATH = "$InstallDir;$env:PATH"
        Write-Info "Added $InstallDir to user PATH"
        Write-Info "Restart your terminal for PATH changes to take effect"
    }
}

function Main {
    Write-Info "Bagdock CLI Installer"
    Write-Host ""

    Test-NodeVersion

    if ($env:BAGDOCK_INSTALL) {
        Install-ToDir
    } else {
        Install-ViaNpm
    }

    Write-Host ""
    Write-Ok "Bagdock CLI installed successfully!"
    Write-Host ""
    Write-Info "Get started:"
    Write-Host "  bagdock login"
    Write-Host "  bagdock doctor"
    Write-Host "  bagdock init"
    Write-Host ""
}

Main
