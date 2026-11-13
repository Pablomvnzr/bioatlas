$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $repoPath 'data\deploy\cloud.env'
if (!(Test-Path -LiteralPath $envPath)) { throw 'Falta data/deploy/cloud.env con la conexion Atlas preparada.' }

function Read-PrivateValue([string]$message) {
    $secureValue = Read-Host $message -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

Write-Host 'Configuracion local de BioAtlas. No pegues estas claves en el chat.'
Write-Host 'Se guardaran en data/deploy/cloud.env, excluido de Git. No compartas ese archivo.'
$dbPassword = Read-PrivateValue 'Contrasena de la base de Supabase (la elegiste al crear el proyecto)'
if ([string]::IsNullOrWhiteSpace($dbPassword)) { throw 'La contrasena esta vacia.' }
$serviceKey = (Read-PrivateValue 'Secret key de Supabase (API Keys > Secret keys > Copy API key)').Trim()
if ($serviceKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {
    throw 'Usa la Secret key de BioAtlas que comienza con sb_secret_, no publishable.'
}
$values = [ordered]@{
    DATABASE_URL = ('postgresql://postgres.unoqrbnrpnewrrapfvrf:' + [Uri]::EscapeDataString($dbPassword) + '@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full')
    SUPABASE_URL = 'https://unoqrbnrpnewrrapfvrf.supabase.co'
    SUPABASE_SERVICE_ROLE_KEY = $serviceKey
    SUPABASE_STORAGE_BUCKET = 'bioatlas-media'
    MEDIA_STORAGE = 'supabase'
    MONGODB_DATABASE = 'bioatlas'
    NODE_ENV = 'production'
}
$lines = @(Get-Content -LiteralPath $envPath | Where-Object {
    $name = ($_ -split '=', 2)[0]
    !$values.Contains($name)
})
foreach ($entry in $values.GetEnumerator()) { $lines += "$($entry.Key)=$($entry.Value)" }
[IO.File]::WriteAllLines($envPath, $lines, (New-Object Text.UTF8Encoding($false)))
$dbPassword = $null
$serviceKey = $null
$values = $null
$lines = $null
Write-Host 'Configuracion guardada. Avisa que termino; todavia falta comprobar conexiones y publicar.' -ForegroundColor Green
