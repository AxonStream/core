param(
    [Parameter(Mandatory = $true)][string]$NpmToken
)
$ErrorActionPreference = "Stop"

Write-Host "Verify gate..." -ForegroundColor Cyan
npm run publish:verify

$env:NODE_AUTH_TOKEN = $NpmToken
Write-Host "Publishing packages/* to npmjs.com..." -ForegroundColor Cyan

Get-ChildItem -Path "packages" -Directory | ForEach-Object {
    $pkgDir = $_.FullName
    $pj = Join-Path $pkgDir "package.json"
    if (-not (Test-Path $pj)) { return }
    $json = Get-Content $pj -Raw | ConvertFrom-Json
    if ($json.private -eq $true) { Write-Host "skip $($json.name) (private)"; return }

    $name = $json.name; $ver = $json.version
    cmd /c "npm view $name@$ver version >NUL 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "skip $name@$ver (exists)"
        return
    }
    Push-Location $pkgDir
    try {
        Write-Host "publish $name@$ver" -ForegroundColor Green
        npm publish --access public --provenance
    }
    finally { Pop-Location }
}
