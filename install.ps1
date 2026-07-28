# install.ps1 - Windows installation script for free-code CLI
# Supports Windows 7 SP1 and later
# Usage: irm https://raw.githubusercontent.com/paoloanzn/free-code/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

# -------------------------------------------------------------------
# Helpers (compatible with PowerShell 2.0 on Windows 7)
# -------------------------------------------------------------------

function Write-Info($msg)    { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "[x] $msg" -ForegroundColor Red }

function Download-File($url, $dest) {
    # Use TLS 1.2 for older Windows compatibility (GitHub requires it).
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    } catch {
        # On very old .NET the Tls12 enum value may be missing; set it by number (3072).
        [Net.ServicePointManager]::SecurityProtocol = 3072
    }

    # Prefer Invoke-WebRequest (PS 3+) with -UseBasicParsing to avoid the IE engine.
    $psVersion = $PSVersionTable.PSVersion.Major
    if ($psVersion -ge 3) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
            return $true
        } catch {
            Write-Warn "Invoke-WebRequest failed, falling back to WebClient: $_"
        }
    }

    # Fallback: System.Net.WebClient works on PowerShell 2.0 / Windows 7.
    try {
        $client = New-Object System.Net.WebClient
        $client.Headers.Add("User-Agent", "free-code-installer")
        $client.DownloadFile($url, $dest)
        return $true
    } catch {
        Write-Err "WebClient download failed: $_"
        return $false
    }
}

function Header {
    Write-Host ""
    Write-Host "   ___                            _            " -ForegroundColor Cyan
    Write-Host "  / _|_ __ ___  ___        ___ __| | ___       " -ForegroundColor Cyan
    Write-Host " | |_| '__/ _ \/ _ \_____ / __/ _` |/ _ \      " -ForegroundColor Cyan
    Write-Host " |  _| | |  __/  __/_____| (_| (_| |  __/      " -ForegroundColor Cyan
    Write-Host " |_| |_|  \___|\___|      \___\__,_|\___|      " -ForegroundColor Cyan
    Write-Host "  The free build of Claude Code" -ForegroundColor DarkGray
    Write-Host ""
}

# -------------------------------------------------------------------
# Step 1: Check Windows version (require at least 6.1 = Windows 7 SP1)
# -------------------------------------------------------------------

$osVersion = [System.Environment]::OSVersion.Version
Write-Info "Detected Windows version: $($osVersion.ToString())"

if ($osVersion.Major -lt 6 -or ($osVersion.Major -eq 6 -and $osVersion.Minor -lt 1)) {
    Write-Err "Windows 7 SP1 (version 6.1) or later is required."
    Write-Err "Your version: $($osVersion.ToString())"
    exit 1
}

if ($osVersion.Major -eq 6 -and $osVersion.Minor -eq 1) {
    Write-Warn "Windows 7 detected. Some features may be limited."
    Write-Warn "Bun runtime requires Windows 10+. Using compiled binary mode."
}

# -------------------------------------------------------------------
# Step 2: Set install directory
# -------------------------------------------------------------------

$installDir = Join-Path $env:LOCALAPPDATA "free-code"
Write-Info "Install directory: $installDir"

if (Test-Path $installDir) {
    Write-Info "Install directory already exists. Updating existing installation."
} else {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Write-Info "Created install directory."
}

# -------------------------------------------------------------------
# Step 3: Download CLI binary from GitHub releases
# -------------------------------------------------------------------

# Match the repo used by install.sh (paoloanzn/free-code). The Windows
# compiled binary is published as free-code-windows-x64.exe on releases.
$downloadUrl = "https://github.com/paoloanzn/free-code/releases/latest/download/free-code-windows-x64.exe"
$binaryPath  = Join-Path $installDir "free-code.exe"
$tempPath    = Join-Path $env:TEMP "free-code-download.exe"

Write-Info "Downloading CLI binary from $downloadUrl ..."
$dlOk = Download-File -url $downloadUrl -dest $tempPath
if (-not $dlOk) {
    Write-Err "Failed to download CLI binary."
    Write-Info "You can manually build from source:"
    Write-Info "  1. Install Bun from https://bun.sh"
    Write-Info "  2. Clone: git clone https://github.com/paoloanzn/free-code.git"
    Write-Info "  3. Run:   bun install"
    Write-Info "  4. Run:   bun run build:dev:full -- --windows"
    Write-Info "  5. Copy ./cli-dev.exe to $binaryPath"
    exit 1
}
Write-Success "Download complete."

# -------------------------------------------------------------------
# Step 4: Install binary (update if already exists)
# -------------------------------------------------------------------

try {
    Move-Item -Path $tempPath -Destination $binaryPath -Force
    Write-Success "Installed CLI to $binaryPath"
} catch {
    Write-Err "Failed to move binary into place: $_"
    if (Test-Path $tempPath) { Remove-Item $tempPath -Force -ErrorAction SilentlyContinue }
    exit 1
}

# -------------------------------------------------------------------
# Step 5: Add to PATH (user scope, persistent + current session)
# -------------------------------------------------------------------

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }

if ($userPath -notlike "*$installDir*") {
    if ($userPath -ne "") {
        $newPath = "$userPath;$installDir"
    } else {
        $newPath = "$installDir"
    }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    if (-not ($env:Path -like "*$installDir*")) {
        $env:Path += ";$installDir"
    }
    Write-Success "Added $installDir to user PATH."
} else {
    Write-Info "$installDir is already in PATH."
}

# -------------------------------------------------------------------
# Step 6: Bun runtime detection
# -------------------------------------------------------------------

$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if ($bunCmd) {
    Write-Success "Bun runtime detected at: $($bunCmd.Source)"
} else {
    if ($osVersion.Major -ge 10) {
        Write-Warn "Bun runtime not found."
        Write-Info "To enable development features, install Bun:"
        Write-Info "  powershell -c ""irm bun.sh/install.ps1 | iex"""
    } else {
        Write-Info "Bun runtime not found (expected on Windows 7)."
        Write-Info "Using compiled binary mode. Development features are not available."
    }
}

# -------------------------------------------------------------------
# Step 7: Verify installation
# -------------------------------------------------------------------

Write-Info "Verifying installation..."
try {
    $result = & $binaryPath --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Installation verified: $result"
    } else {
        Write-Warn "Binary returned non-zero exit code. It may need to be run manually."
    }
} catch {
    Write-Warn "Could not verify installation. The binary may need to be run manually."
}

# -------------------------------------------------------------------
# Step 8: Write install manifest
# -------------------------------------------------------------------

$manifestPath = Join-Path $installDir "install-manifest.txt"
$manifestContent = @"
# free-code install manifest - generated by install.ps1
# This file is used by uninstall.ps1 to remove all installed files.
# Do not edit manually.
$($env:LOCALAPPDATA)\free-code\
$($env:LOCALAPPDATA)\free-code\free-code.exe
$($env:LOCALAPPDATA)\free-code\install-manifest.txt
"@

try {
    Set-Content -Path $manifestPath -Value $manifestContent -Encoding ASCII
    Write-Success "Install manifest written to $manifestPath"
} catch {
    Write-Warn "Failed to write install manifest: $_"
}

# -------------------------------------------------------------------
# Done
# -------------------------------------------------------------------

Write-Host ""
Write-Success "Installation complete!"
Write-Host ""
Write-Host "  Run it:" -ForegroundColor White
Write-Host "    free-code                          # interactive REPL" -ForegroundColor Cyan
Write-Host "    free-code -p ""your prompt""          # one-shot mode" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Set your API key:" -ForegroundColor White
Write-Host "    `$env:ANTHROPIC_API_KEY = ""sk-ant-...""" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Or log in with Claude.ai:" -ForegroundColor White
Write-Host "    free-code /login" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Source: $installDir" -ForegroundColor DarkGray
Write-Host "  Binary: $binaryPath" -ForegroundColor DarkGray
Write-Host ""
