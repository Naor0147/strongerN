# scripts/exclude-defender.ps1
# Run this script as Administrator to exclude project paths from Windows Defender.
# This prevents Defender from slowing down Gradle compilation and I/O tasks by 40-60%.

# Check if running as Administrator
$isAdmin = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent().IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Error: This script must be run as an Administrator!" -ForegroundColor Red
    Write-Host "Please open an Administrator PowerShell prompt and run this script again." -ForegroundColor Yellow
    exit 1
}

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$GradleCache = Join-Path $env:USERPROFILE ".gradle"

$PathsToExclude = @(
    $ProjectRoot.Path,
    $GradleCache
)

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "           Windows Defender Build Speed Optimizer Setup" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($Path in $PathsToExclude) {
    if (Test-Path $Path) {
        Write-Host "Excluding path: $Path..." -NoNewline -ForegroundColor Gray
        try {
            Add-MpPreference -ExclusionPath $Path
            Write-Host " [SUCCESS]" -ForegroundColor Green
        } catch {
            Write-Host " [FAILED] ($_)" -ForegroundColor Red
        }
    } else {
        Write-Host "Path not found, skipping: $Path" -ForegroundColor Yellow
    }
}

Write-Host "`nAll exclusions processed! Windows Defender will no longer scan these build folders." -ForegroundColor Green
Write-Host "This should speed up your Gradle/React Native builds significantly." -ForegroundColor Green
