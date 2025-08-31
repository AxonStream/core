param(
    [Parameter(Mandatory = $true)][string]$GitHubToken
)
$ErrorActionPreference = "Stop"

# Route your scope to GitHub Packages (repo-local)
npm config set @AxonStream:registry https://npm.pkg.github.com --location=project | Out-Null

Write-Host "Verify gate..." -ForegroundColor Cyan
npm run publish:verify

$env:NODE_AUTH_TOKEN = $GitHubToken
Write-Host "Publishing packages/* to GitHub Packages..." -ForegroundColor Cyan

Get-ChildItem -Path "packages" -Directory | ForEach-Object {
    $pkgDir = $_.FullName
    $pj = Join-Path $pkgDir "package.json"
    if (-not (Test-Path $pj)) { return }
    $json = Get-Content $pj -Raw | ConvertFrom-Json
    if ($json.private -eq $true) { Write-Host "skip $($json.name) (private)"; return }

    $name = $json.name; $ver = $json.version
    # MUST be scoped to @AxonStream/...
    cmd /c "npm view $name@$ver version --registry=https://npm.pkg.github.com >NUL 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "skip $name@$ver (exists)"
        return
    }
    Push-Location $pkgDir
    try {
        Write-Host "publish $name@$ver" -ForegroundColor Green
        npm publish --access public --registry=https://npm.pkg.github.com
    }
    finally { Pop-Location }
}
