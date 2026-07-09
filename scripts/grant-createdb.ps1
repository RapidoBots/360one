# Run this in an elevated PowerShell (Run as Administrator).
# Grants the app role permission to create databases, needed for
# Prisma's shadow database during `prisma migrate dev`.

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

& "$pgBin\psql.exe" -U postgres -h localhost -c "ALTER ROLE app CREATEDB;"

Copy-Item "$hba.bak" $hba -Force
Remove-Item "$hba.bak"
Restart-Service $service

Write-Host "Done. Role 'app' can now create databases (needed for Prisma's shadow DB)."
