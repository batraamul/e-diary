# E-Diary: a small web server for the diary folder, on this computer only (http://localhost:47812/).
# Started hidden by start.ps1. Nothing leaves the computer; only this PC can open the address.
param([int]$Port = 47812, [switch]$Quiet, [string]$Log = '')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path.TrimEnd('\', '/')
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'
  '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.mp3' = 'audio/mpeg'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  $msg = "Port $Port is in use by another program, or Windows refused it: $($_.Exception.Message)"
  if ($Log) { $msg | Out-File -FilePath $Log -Append -Encoding utf8 }
  if (-not $Quiet) { Write-Host $msg -ForegroundColor Red; Read-Host 'Press Enter to close' }
  exit 1
}
if (-not $Quiet) { Write-Host "E-Diary is running at http://localhost:$Port/  (keep this window open; close it to stop)" -ForegroundColor Green }
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq '/__ediary_root') {           # lets the starter check that this server shows THIS folder
      $b = [System.Text.Encoding]::UTF8.GetBytes($root); $res.ContentType = 'text/plain; charset=utf-8'; $res.AddHeader('Cache-Control', 'no-store')
      $res.ContentLength64 = $b.Length; $res.OutputStream.Write($b, 0, $b.Length); continue
    }
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
    $rel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    $inside = $full.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    if ($inside -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.AddHeader('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else {
      $res.StatusCode = 404
      $m = [System.Text.Encoding]::UTF8.GetBytes('Not found'); $res.OutputStream.Write($m, 0, $m.Length)
    }
  } catch { if ($Log) { ($_ | Out-String) | Out-File -FilePath $Log -Append -Encoding utf8 } }
  finally { try { $res.Close() } catch { } }
}
