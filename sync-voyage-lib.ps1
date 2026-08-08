<#
.SYNOPSIS
  Rebuilds voyage-lib and pushes the output into voyage-ledger's and
  voyage-expense's locally installed copy, for fast local iteration
  without publishing a new npm version on every change.

.NOTES
  Both consuming apps resolve "voyage-lib" through pnpm's content-addressable
  store: <app>/node_modules/voyage-lib is a symlink into
  <app>/node_modules/.pnpm/voyage-lib@<version>_.../node_modules/voyage-lib.
  Copying through that symlink lands the files in the real store folder, so
  this works regardless of which exact version/hash is currently installed.

  This is a throwaway local sync, not a substitute for publishing: the next
  `pnpm install` in either app wipes it and restores the real published
  version. Run `npm publish` from voyage-lib/dist/voyage-lib (after bumping
  the version) when you want the change to stick.
#>

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$libRoot = Join-Path $root "voyage-lib"
$libDist = Join-Path $libRoot "dist\voyage-lib"

Write-Host "Building voyage-lib..." -ForegroundColor Cyan
Push-Location $libRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "voyage-lib build failed (exit $LASTEXITCODE)" }
}
finally {
    Pop-Location
}

if (-not (Test-Path $libDist)) {
    throw "Build output not found at $libDist"
}

function Sync-Robocopy($source, $destination) {
    robocopy $source $destination /MIR /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed copying $source -> $destination (exit $LASTEXITCODE)" }
}

$targets = @(
    (Join-Path $root "voyage-ledger\node_modules\voyage-lib"),
    (Join-Path $root "voyage-expense\node_modules\voyage-lib")
)

foreach ($target in $targets) {
    if (-not (Test-Path $target)) {
        Write-Warning "Skipping $target (not found - is voyage-lib installed there?)"
        continue
    }

    Write-Host "Syncing into $target..." -ForegroundColor Cyan
    Sync-Robocopy (Join-Path $libDist "fesm2022") (Join-Path $target "fesm2022")
    Sync-Robocopy (Join-Path $libDist "types") (Join-Path $target "types")
    Copy-Item -Path (Join-Path $libDist "package.json") -Destination (Join-Path $target "package.json") -Force
}

Write-Host "Done. Local-only sync - wiped on the next 'pnpm install' in either app." -ForegroundColor Green
exit 0
