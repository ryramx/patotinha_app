# Cria, no PostgreSQL instalado no computador, o usuário da aplicação e os bancos
# "patotinha" e "patotinha_teste" (tarefa 3.8 do plano). Use só em desenvolvimento.
#
# Uso, na raiz do repositório:
#   powershell -ExecutionPolicy Bypass -File scripts\criar-banco-local.ps1
#
# O psql vai pedir a senha do superusuário "postgres" (definida quando o
# PostgreSQL foi instalado). Ela não é guardada em lugar nenhum.

param(
  [string]$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe",
  [string]$Superusuario = "postgres"
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$arquivoEnv = Join-Path $raiz ".env"

if (-not (Test-Path $arquivoEnv)) {
  throw "Arquivo .env não encontrado. Copie o .env.example para .env antes."
}

$linha = Get-Content $arquivoEnv | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if ($linha -notmatch '^DATABASE_URL=postgresql://([^:]+):([^@]+)@') {
  throw "DATABASE_URL no .env precisa estar no formato postgresql://usuario:senha@host:porta/banco"
}
$usuario = $Matches[1]
$senha = $Matches[2]

$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$usuario') THEN
    CREATE ROLE $usuario LOGIN PASSWORD '$senha' NOSUPERUSER CREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE $usuario WITH LOGIN PASSWORD '$senha' NOSUPERUSER CREATEDB NOCREATEROLE;
  END IF;
END
`$`$;
SELECT 'CREATE DATABASE patotinha OWNER $usuario ENCODING ''UTF8'''
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'patotinha') \gexec
SELECT 'CREATE DATABASE patotinha_teste OWNER $usuario ENCODING ''UTF8'''
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'patotinha_teste') \gexec
"@

$sql | & $Psql -U $Superusuario -h localhost -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw "O psql terminou com erro." }
Write-Host "Pronto: usuário '$usuario' e bancos 'patotinha' e 'patotinha_teste' criados."
