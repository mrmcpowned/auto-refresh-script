# lint-gm-calls.ps1 — Verify GM_* API calls only appear inside service objects
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/lint-gm-calls.ps1
#
# Allowed zones (by surrounding code pattern):
#   Config       — lines between "const Config = {" and its closing
#   WatchStore   — lines between "const WatchStore = " and its closing
#   RefreshService internals — isEnabled(), startRefresh(), stopRefresh()
#   @grant headers

param(
    [string]$File = "auto-refresh.user.js"
)

$lines = Get-Content $File
$violations = @()

# Track which "zone" we're in
$zone = "OUTSIDE"
$braceDepth = 0
$zoneStartDepth = 0
$funcZoneDepth = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $lineNum = $i + 1

    # Zone entry detection (before brace counting so we capture the opening brace)
    if ($zone -eq "OUTSIDE") {
        if ($line -match '^\s*const Config = \{') { $zone = "Config"; $zoneStartDepth = $braceDepth }
        elseif ($line -match '^\s*const WatchStore = ') { $zone = "WatchStore"; $zoneStartDepth = $braceDepth }
        elseif ($line -match '^\s*function (isEnabled|startRefresh|stopRefresh)\b') {
            $zone = "RefreshService"; $funcZoneDepth = $braceDepth
        }
    }

    # Track brace depth
    $opens = ([regex]::Matches($line, '\{')).Count
    $closes = ([regex]::Matches($line, '\}')).Count
    $braceDepth += $opens - $closes

    # Skip @grant headers
    if ($line -match '^\s*//\s*@grant') { continue }

    # Check for GM_ storage calls outside allowed zones (before zone exit)
    if ($line -match 'GM_(getValue|setValue|listValues)') {
        $api = $Matches[0]
        if ($zone -eq "OUTSIDE") {
            $violations += [PSCustomObject]@{
                Line    = $lineNum
                API     = $api
                Context = $line.Trim().Substring(0, [Math]::Min(80, $line.Trim().Length))
            }
        }
    }

    # Zone exit: when brace depth returns to zone start level
    if ($zone -eq "Config" -and $braceDepth -le $zoneStartDepth -and $closes -gt 0 -and $i -gt 0) {
        $zone = "OUTSIDE"
    }
    if ($zone -eq "WatchStore" -and $braceDepth -le $zoneStartDepth -and $closes -gt 0 -and $i -gt 0) {
        $zone = "OUTSIDE"
    }
    if ($zone -eq "RefreshService" -and $braceDepth -le $funcZoneDepth -and $closes -gt 0 -and $i -gt 0) {
        $zone = "OUTSIDE"
    }
}

if ($violations.Count -eq 0) {
    Write-Host "OK: All GM_* calls are inside service objects." -ForegroundColor Green
    exit 0
} else {
    Write-Host "VIOLATION: $($violations.Count) GM_* call(s) outside service objects:" -ForegroundColor Red
    $violations | ForEach-Object {
        Write-Host "  Line $($_.Line): $($_.API) - $($_.Context)" -ForegroundColor Yellow
    }
    exit 1
}
