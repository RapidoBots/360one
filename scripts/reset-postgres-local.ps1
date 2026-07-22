# Run this in an elevated PowerShell (Run as Administrator).
# One-time local setup: lets us create the app DB/role without knowing the
# postgres superuser password, then restores normal password auth.

$pgData = "C:\Program Files\PostgreSQL\17\data"
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$hba = Join-Path $pgData "pg_hba.conf"
$service = "postgresql-x64-17"

Copy-Item $hba "$hba.bak" -Force

(Get-Content $hba) |
    ForEach-Object {
        if ($_ -match '^(host|local)\s+all\s+all\s') {
            $_ -replace '\s(scram-sha-256|md5|password)\s*$', ' trust'
        } else {
            $_
        }
    } | Set-Content $hba

Restart-Service $service
Start-Sleep -Seconds 3

& "$pgBin\psql.exe" -U postgres -h localhost -c "DROP DATABASE IF EXISTS reservation_saas;"
& "$pgBin\psql.exe" -U postgres -h localhost -c "DROP ROLE IF EXISTS app;"
& "$pgBin\psql.exe" -U postgres -h localhost -c "CREATE ROLE app WITH LOGIN PASSWORD 'app';"
& "$pgBin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE reservation_saas OWNER app;"

Copy-Item "$hba.bak" $hba -Force
Remove-Item "$hba.bak"
Restart-Service $service

Write-Host "Done. Database 'reservation_saas' and role 'app' (password: app) are ready. Password auth has been restored to its original state."
