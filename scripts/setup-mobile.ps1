# setup-mobile.ps1
# Run this once from the project root to set up Capacitor and the Android project.
# Requires: Node.js installed (see step 0 below if not yet installed)
#
# Usage:
#   cd "C:\Users\shane\Downloads\Flat Earth\Fe model\conceptual_flat_earth_model-main"
#   .\scripts\setup-mobile.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=== Shane's Model 2.0 — Mobile Setup ===" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------
# Step 0: Check for Node.js
# ---------------------------------------------------------------
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = & node --version 2>&1
    Write-Host "  Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "Node.js is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install it now with one of these options:" -ForegroundColor White
    Write-Host "  Option A (winget):  winget install OpenJS.NodeJS.LTS"
    Write-Host "  Option B (website): https://nodejs.org  -> Download LTS"
    Write-Host ""
    Write-Host "After installing, close and reopen PowerShell, then run this script again."
    exit 1
}

# ---------------------------------------------------------------
# Step 1: Install Capacitor packages
# ---------------------------------------------------------------
Write-Host ""
Write-Host "Installing Capacitor..." -ForegroundColor Yellow
Set-Location $projectRoot
& npm install
Write-Host "  Done." -ForegroundColor Green

# ---------------------------------------------------------------
# Step 2: Add Android platform
# ---------------------------------------------------------------
Write-Host ""
Write-Host "Adding Android platform..." -ForegroundColor Yellow
if (Test-Path "$projectRoot\android") {
    Write-Host "  android/ folder already exists, skipping cap add android." -ForegroundColor DarkGray
} else {
    & npx cap add android
    Write-Host "  Done." -ForegroundColor Green
}

# ---------------------------------------------------------------
# Step 3: Sync web assets into Android project
# ---------------------------------------------------------------
Write-Host ""
Write-Host "Syncing web assets to Android..." -ForegroundColor Yellow
& npx cap sync android
Write-Host "  Done." -ForegroundColor Green

# ---------------------------------------------------------------
# Done
# ---------------------------------------------------------------
Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Install Android Studio (free):"
Write-Host "     https://developer.android.com/studio"
Write-Host ""
Write-Host "  2. Open the Android project:"
Write-Host "     npx cap open android"
Write-Host "     (or: .\scripts\setup-mobile.ps1 already ran cap sync,"
Write-Host "      just open android/ in Android Studio directly)"
Write-Host ""
Write-Host "  3. In Android Studio:"
Write-Host "     - Wait for Gradle sync to finish"
Write-Host "     - Build > Generate Signed Bundle/APK"
Write-Host "     - Choose Android App Bundle (.aab)"
Write-Host "     - Create a new keystore (save the password somewhere safe)"
Write-Host "     - Build release"
Write-Host ""
Write-Host "  4. Upload the .aab to Google Play Console"
Write-Host "     play.google.com/console  (one-time $25 registration)"
Write-Host ""
Write-Host "  For iOS you need a Mac. See store/store-listing.md for steps."
Write-Host ""
