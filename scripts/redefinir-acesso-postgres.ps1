# Use SOMENTE se a senha do usuario "postgres" foi esquecida. Precisa ser executado
# como administrador do Windows.
#
# O que faz:
#   1. Guarda uma copia do pg_hba.conf e libera, por alguns segundos, o acesso local sem senha.
#   2. Cria o usuario e os bancos da aplicacao (scripts\criar-banco-local.ps1).
#   3. Pede uma NOVA senha para o "postgres" e a grava.
#   4. Devolve o pg_hba.conf original (com senha) e reinicia o servico, mesmo se algo falhar.

param(
  [string]$Pasta = "C:\Program Files\PostgreSQL\18",
  [string]$Servico = "postgresql-x64-18"
)

$ErrorActionPreference = "Stop"
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "Abra o PowerShell como administrador e rode este script de novo." }

$hba = Join-Path $Pasta "data\pg_hba.conf"
$psql = Join-Path $Pasta "bin\psql.exe"
$copia = "$hba.bak-" + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item $hba $copia
Write-Host "Copia de seguranca: $copia"

try {
  $linhas = Get-Content $hba
  $linhas = $linhas | ForEach-Object {
    if ($_ -match '^\s*(local|host)\s' -and $_ -notmatch 'replication') { $_ -replace 'scram-sha-256|md5', 'trust' } else { $_ }
  }
  Set-Content -Path $hba -Value $linhas -Encoding ASCII
  Restart-Service $Servico
  Start-Sleep -Seconds 3

  & (Join-Path $PSScriptRoot "criar-banco-local.ps1") -Psql $psql

  $nova = Read-Host "Digite uma NOVA senha para o usuario postgres (guarde-a bem)" -AsSecureString
  $texto = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($nova))
  if ($texto.Length -lt 8) { throw "A senha precisa ter pelo menos 8 caracteres. Nada foi alterado na senha." }
  $escapada = $texto.Replace("'", "''")
  "ALTER USER postgres WITH PASSWORD '$escapada';" | & $psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel trocar a senha do postgres." }
  Write-Host "Senha do postgres trocada."
}
finally {
  Copy-Item $copia $hba -Force
  Restart-Service $Servico
  Write-Host "Configuracao original (com senha) restaurada e servico reiniciado."
}
