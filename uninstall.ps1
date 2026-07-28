# free-code uninstaller for Windows
# Usage: irm https://raw.githubusercontent.com/paoloanzn/free-code/main/uninstall.ps1 | iex
#   -Purge     Remove everything including user data (no confirmation)
#   -KeepData  Remove only binary, keep user data (no confirmation)

param(
    [switch]$Purge = $false,
    [switch]$KeepData = $false
)

$ErrorActionPreference = "Stop"

# -------------------------------------------------------------------
# Helpers (compatible with PowerShell 2.0 on Windows 7)
# -------------------------------------------------------------------

function Write-Info($msg)    { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "[x] $msg" -ForegroundColor Red }

# -------------------------------------------------------------------
# Read install manifest
# -------------------------------------------------------------------

$installDir = Join-Path $env:LOCALAPPDATA "free-code"
$manifestPath = Join-Path $installDir "install-manifest.txt"
$manifestPaths = @()

if (Test-Path $manifestPath) {
    Write-Info "Reading install manifest..."
    try {
        $lines = Get-Content -Path $manifestPath
        foreach ($line in $lines) {
            $trimmed = $line.Trim()
            if ($trimmed -ne "" -and -not $trimmed.StartsWith("#")) {
                $manifestPaths += $trimmed
            }
        }
        Write-Success "Manifest loaded ($($manifestPaths.Count) paths)."
    } catch {
        Write-Warn "Failed to read manifest: $_"
        Write-Info "Using default paths."
    }
} else {
    Write-Warn "Install manifest not found at $manifestPath"
    Write-Info "Using default paths."
}

# Fallback: default paths if manifest was missing or empty
if ($manifestPaths.Count -eq 0) {
    $manifestPaths = @(
        (Join-Path $env:LOCALAPPDATA "free-code\free-code.exe"),
        (Join-Path $env:LOCALAPPDATA "free-code\install-manifest.txt"),
        (Join-Path $env:LOCALAPPDATA "free-code\")
    )
}

# -------------------------------------------------------------------
# Remove installed files
# -------------------------------------------------------------------

$deletedPaths = @()
$skippedPaths = @()

Write-Info "Removing installed files..."

# Remove individual files first, then directories (order matters)
$files = @()
$dirs = @()
foreach ($p in $manifestPaths) {
    if ($p.EndsWith("\")) {
        $dirs += $p
    } else {
        $files += $p
    }
}

foreach ($file in $files) {
    if (Test-Path $file) {
        try {
            Remove-Item -Path $file -Force -ErrorAction Stop
            Write-Success "Deleted: $file"
            $deletedPaths += $file
        } catch {
            Write-Err "Failed to delete: $file - $_"
            $skippedPaths += $file
        }
    } else {
        # Silently skip non-existent paths
    }
}

foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item -Path $dir -Recurse -Force -ErrorAction Stop
            Write-Success "Deleted: $dir"
            $deletedPaths += $dir
        } catch {
            Write-Err "Failed to delete: $dir - $_"
            $skippedPaths += $dir
        }
    } else {
        # Silently skip non-existent paths
    }
}

# -------------------------------------------------------------------
# Remove from PATH
# -------------------------------------------------------------------

Write-Info "Removing from PATH..."

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }

if ($userPath -like "*$installDir*") {
    try {
        $pathParts = $userPath.Split(";")
        $newParts = @()
        foreach ($part in $pathParts) {
            $trimmed = $part.Trim()
            if ($trimmed -ne "" -and $trimmed -ne $installDir) {
                $newParts += $trimmed
            }
        }
        $newPath = $newParts -join ";"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")

        # Update current session
        $sessionParts = $env:Path.Split(";")
        $newSessionParts = @()
        foreach ($part in $sessionParts) {
            $trimmed = $part.Trim()
            if ($trimmed -ne "" -and $trimmed -ne $installDir) {
                $newSessionParts += $trimmed
            }
        }
        $env:Path = $newSessionParts -join ";"

        Write-Success "Removed $installDir from user PATH."
    } catch {
        Write-Err "Failed to update PATH: $_"
    }
} else {
    Write-Info "$installDir was not in PATH."
}

# -------------------------------------------------------------------
# Handle user data
# -------------------------------------------------------------------

$roamingDataDir = Join-Path $env:APPDATA "claude"
$localDataDir = Join-Path $env:LOCALAPPDATA "claude"

$roamingExists = Test-Path $roamingDataDir
$localExists = Test-Path $localDataDir
$hasUserData = $roamingExists -or $localExists

$removedUserData = $false

if ($Purge) {
    # -Purge: delete everything including user data, no confirmation
    if ($hasUserData) {
        Write-Info "Purge mode: removing user data..."
        if ($roamingExists) {
            try {
                Remove-Item -Path $roamingDataDir -Recurse -Force -ErrorAction Stop
                Write-Success "Deleted: $roamingDataDir"
                $removedUserData = $true
            } catch {
                Write-Err "Failed to delete: $roamingDataDir - $_"
            }
        }
        if ($localExists) {
            try {
                Remove-Item -Path $localDataDir -Recurse -Force -ErrorAction Stop
                Write-Success "Deleted: $localDataDir"
                $removedUserData = $true
            } catch {
                Write-Err "Failed to delete: $localDataDir - $_"
            }
        }
    } else {
        Write-Info "No user data directories found."
    }
} elseif ($KeepData) {
    # -KeepData: skip user data removal, no confirmation
    Write-Info "KeepData mode: preserving user data."
} else {
    # Interactive: ask the user
    if ($hasUserData) {
        Write-Host ""
        Write-Host "Remove user data (configs, sessions, cache)? [y/N] " -ForegroundColor Yellow -NoNewline
        $response = Read-Host
        if ($response -eq "y" -or $response -eq "Y") {
            if ($roamingExists) {
                try {
                    Remove-Item -Path $roamingDataDir -Recurse -Force -ErrorAction Stop
                    Write-Success "Deleted: $roamingDataDir"
                    $removedUserData = $true
                } catch {
                    Write-Err "Failed to delete: $roamingDataDir - $_"
                }
            }
            if ($localExists) {
                try {
                    Remove-Item -Path $localDataDir -Recurse -Force -ErrorAction Stop
                    Write-Success "Deleted: $localDataDir"
                    $removedUserData = $true
                } catch {
                    Write-Err "Failed to delete: $localDataDir - $_"
                }
            }
        } else {
            Write-Info "User data preserved."
        }
    } else {
        Write-Info "No user data directories found."
    }
}

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------

Write-Host ""
Write-Host "=== Uninstall Summary ===" -ForegroundColor White
Write-Host ""

if ($deletedPaths.Count -gt 0) {
    Write-Host "  Deleted:" -ForegroundColor Green
    foreach ($p in $deletedPaths) {
        Write-Host "    - $p" -ForegroundColor Green
    }
}

if ($skippedPaths.Count -gt 0) {
    Write-Host "  Failed to delete:" -ForegroundColor Red
    foreach ($p in $skippedPaths) {
        Write-Host "    - $p" -ForegroundColor Red
    }
}

if ($removedUserData) {
    Write-Host "  User data: removed" -ForegroundColor Green
} elseif ($hasUserData) {
    Write-Host "  User data: preserved" -ForegroundColor Yellow
    if ($roamingExists) {
        Write-Host "    - $roamingDataDir" -ForegroundColor DarkGray
    }
    if ($localExists) {
        Write-Host "    - $localDataDir" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  User data: none found" -ForegroundColor DarkGray
}

Write-Host ""
Write-Success "Uninstall complete."
Write-Host ""
