# Export canonical source only. No credentials, local records or generated build/test output.
# The checked-in database.generated.ts schema contract is canonical source.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
$exportRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot 'artifacts'))
if (-not $exportRoot.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Export destination is outside the workspace.'
}
if ((Test-Path -LiteralPath $exportRoot) -and ((Get-Item -LiteralPath $exportRoot).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Export destination must not be a symbolic link or junction.'
}

$rootFiles = @(
    '.env.example', '.gitignore', '.vscode/settings.json',
    'AGENT.md', 'AGENTS.md', 'CLAUDE.md', 'PRD.md', 'PRODUCT-VISION.md',
    'ARCHITECTURE.md', 'ARCHITECTURE-ESSENTIALS.md', 'BUILD-ROADMAP.md',
    'package.json', 'package-lock.json', 'tsconfig.json',
    'next.config.ts', 'tailwind.config.ts', 'postcss.config.mjs',
    'eslint.config.mjs', 'proxy.ts', 'instrumentation.ts',
    'playwright.config.ts', 'playwright.workflow.config.ts'
)
$sourceFiles = [Collections.Generic.List[IO.FileInfo]]::new()
if ((Get-Item -LiteralPath (Join-Path $workspaceRoot '.vscode')).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Workspace settings must not be read through a symbolic link or junction.'
}
foreach ($relative in $rootFiles) {
    $file = Get-Item -LiteralPath (Join-Path $workspaceRoot $relative)
    if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked file refused: $relative" }
    $sourceFiles.Add($file)
}
$pending = [Collections.Generic.Queue[string]]::new()
foreach ($dir in @('app', 'components', 'lib', 'public', 'supabase', 'tests', 'docs', 'scripts')) {
    $pending.Enqueue((Join-Path $workspaceRoot $dir))
}
while ($pending.Count) {
    $directory = $pending.Dequeue()
    if ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Linked source directories are not included in an export.'
    }
    foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked source refused: $($entry.Name)" }
        if ($entry.PSIsContainer) {
            if ($entry.Name -notin @('node_modules', '.next', '.git', 'artifacts', 'test-results', 'workflow-test-results', 'playwright-report', 'coverage')) {
                $pending.Enqueue($entry.FullName)
            }
        } elseif ($entry.Name -notmatch '^\.env($|\.)|\.(zip|tgz|pem|key|log|tsbuildinfo)$') {
            $sourceFiles.Add($entry)
        }
    }
}

New-Item -ItemType Directory -Path $exportRoot -Force | Out-Null
$exportPath = Join-Path $exportRoot ('trustlink-source-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '.zip')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [IO.File]::Open($exportPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $sourceFiles | Sort-Object FullName) {
            $relative = $file.FullName.Substring($workspacePrefix.Length).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
Write-Output "Exported $($sourceFiles.Count) canonical files to $exportPath"
