# free-code installer for Windows (no WSL required)
# Usage: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

# -------------------------------------------------------------------
# Banner
# -------------------------------------------------------------------

Write-Host ""
Write-Host "  ___                            _       " -ForegroundColor Cyan
Write-Host " / _|_ __ ___  ___        ___ __| | ___  " -ForegroundColor Cyan
Write-Host "| |_| '__/ _ \/ _ \_____ / __/ _` |/ _ \ " -ForegroundColor Cyan
Write-Host "|  _| | |  __/  __/_____| (_| (_| |  __/ " -ForegroundColor Cyan
Write-Host "|_| |_|  \___|\___|      \___\__,_|\___|  " -ForegroundColor Cyan
Write-Host "  The free build of Claude Code" -ForegroundColor DarkGray
Write-Host ""

function Info {
    Param([string]$Msg)
    Write-Host "[*] $Msg" -ForegroundColor Cyan
}
function Ok {
    Param([string]$Msg)
    Write-Host "[+] $Msg" -ForegroundColor Green
}
function Warn {
    Param([string]$Msg)
    Write-Host "[!] $Msg" -ForegroundColor Yellow
}
function Fail {
    Param([string]$Msg)
    Write-Host "[x] $Msg" -ForegroundColor Red
    exit 1
}

# -------------------------------------------------------------------
# System checks
# -------------------------------------------------------------------

$OS = if ($PSVersionTable.PSEdition -eq "Desktop") {
    if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
} else {
    "win64"
}
Ok "OS: Windows $OS"

function Test-CommandExists {
    Param([string]$Cmd)
    $null -ne (Get-Command $Cmd -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists "git")) {
    Fail "git is not installed. Get it from https://git-scm.com/download/win"
}
$gitVer = git --version | Select-Object -First 1
Ok "git: $gitVer"

$BUN_MIN_VERSION = "1.3.11"

# Check or install Bun
$bunPath = $null
if (Test-CommandExists "bun") {
    $bunPath = (Get-Command bun).Source
    $bunVer = bun --version 2>$null
    $bunVerParts = $bunVer.Split('.')
    $minParts = $BUN_MIN_VERSION.Split('.')
    $needsUpgrade = $false
    for ($i = 0; $i -lt $minParts.Length; $i++) {
        $a = [int]$bunVerParts[$i]
        $b = [int]$minParts[$i]
        if ($a -gt $b) { break }
        if ($a -lt $b) { $needsUpgrade = $true; break }
    }
    if ($needsUpgrade) {
        Warn "Bun v$bunVer found but v${BUN_MIN_VERSION}+ required. Upgrading..."
        $bunPath = $null
    } else {
        Ok "bun: v$bunVer"
    }
}

if (-not $bunPath) {
    Info "Installing Bun..."
    try {
        powershell -c "irm https://bun.sh/install.ps1 | iex"
    } catch {
        # Try iwr fallback
        Invoke-RestMethod -Uri "https://bun.sh/install.ps1" | Invoke-Expression
    }

    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (Test-CommandExists "bun") {
        $bunPath = (Get-Command bun).Source
        $bunVer = bun --version
        Ok "bun: v$bunVer (just installed)"
    } else {
        $bunDir = Join-Path $env:LOCALAPPDATA "Programs\bun"
        if (Test-Path (Join-Path $bunDir "bun.exe")) {
            $bunPath = Join-Path $bunDir "bun.exe"
            Ok "bun: found at $bunPath"
            # Add to PATH for this session
            $env:Path = "$bunDir;$env:Path"
        } else {
            Fail "Bun installed but not found on PATH. Restart your terminal and retry."
        }
    }
}

if (-not $bunPath) {
    Fail "Bun installation failed. Please install manually from https://bun.sh"
}

# -------------------------------------------------------------------
# Clone repo
# -------------------------------------------------------------------

$REPO = "https://github.com/freecodexyz/free-code.git"
$INSTALL_DIR = Join-Path $env:USERPROFILE "free-code"
$LINK_DIR = Join-Path $env:LOCALAPPDATA "Programs\free-code"
$LINK_PATH = Join-Path $LINK_DIR "free-code.ps1"

Info "Target directory: $INSTALL_DIR"

if (-not (Test-Path $INSTALL_DIR)) {
    Info "Cloning repository..."
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
    Ok "Source: $INSTALL_DIR"
} else {
    Info "Directory already exists, pulling latest..."
    Push-Location $INSTALL_DIR
    try {
        git pull --ff-only
        Ok "Updated: $INSTALL_DIR"
    } catch {
        Warn "Pull failed, using existing copy"
    }
    Pop-Location
}

# -------------------------------------------------------------------
# Build
# -------------------------------------------------------------------

Info "Installing dependencies..."
Push-Location $INSTALL_DIR
& $bunPath install --frozen-lockfile 2>$null
if ($LASTEXITCODE -ne 0) {
    Info "Retrying without frozen lockfile..."
    & $bunPath install
}
Ok "Dependencies installed"

Info "Building free-code (all experimental features enabled)..."
& $bunPath run build:dev:full
Ok "Build complete"

Pop-Location

# -------------------------------------------------------------------
# Symlink
# -------------------------------------------------------------------

if (-not (Test-Path $LINK_DIR)) {
    New-Item -ItemType Directory -Path $LINK_DIR -Force | Out-Null
}

# Create a PowerShell wrapper script
$escapedPath = $INSTALL_DIR.Replace('"', '`"')
$wrapper = @"
`$ErrorActionPreference = 'Stop'
`$ROOT = '$escapedPath'
`$CLI = Join-Path `$ROOT 'cli-dev.exe'
if (Test-Path (Join-Path `$ROOT 'cli.exe')) {
    `$CLI = Join-Path `$ROOT 'cli.exe'
}
Set-Location `$ROOT
& `$CLI @args
"@

$wrapper | Out-File -FilePath $LINK_PATH -Encoding UTF8
Ok "Installed: $LINK_PATH"

# Add to PATH if not already there
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")

if ($machinePath -notlike "*$LINK_DIR*" -and $userPath -notlike "*$LINK_DIR*") {
    Info "Adding $LINK_DIR to user PATH..."
    [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$LINK_DIR", "User")
    $env:Path = "$env:Path;$LINK_DIR"
    Warn "Please restart your terminal for PATH to take effect."
}

# Register .ps1 execution policy for the link
$execPolicy = Get-ExecutionPolicy -Scope CurrentUser
if ($execPolicy -eq "Restricted") {
    Info "Setting execution policy to RemoteSigned for current user..."
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
}

# -------------------------------------------------------------------
# Done
# -------------------------------------------------------------------

Write-Host ""
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Run it:" -ForegroundColor Cyan
Write-Host "    free-code.ps1                          # interactive REPL" -ForegroundColor Green
Write-Host "    free-code.ps1 -p `"your prompt`"        # one-shot mode" -ForegroundColor Green
Write-Host "    free-code.ps1 /login                   # authenticate" -ForegroundColor Green
Write-Host ""
Write-Host "  Set your API key (optional):" -ForegroundColor Cyan
Write-Host "    `$env:ANTHROPIC_API_KEY = `"sk-ant-...`"" -ForegroundColor Green
Write-Host "    `$env:CLAUDE_CODE_USE_OPENAI = 1      # use OpenAI Codex" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Source: $INSTALL_DIR" -ForegroundColor DarkGray
Write-Host "  Binary: $INSTALL_DIR\cli-dev.exe" -ForegroundColor DarkGray
Write-Host "  Launch: $LINK_PATH" -ForegroundColor DarkGray
Write-Host ""
