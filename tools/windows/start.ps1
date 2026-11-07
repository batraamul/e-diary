# E-Diary for Windows: starts the hidden diary server at http://localhost:47812/ (if it is not running yet, or if it
# shows another copy of the folder) and opens the diary in its own Edge or Chrome window.
# Always the same address, so the browser always finds the same diary data.
$ErrorActionPreference = 'SilentlyContinue'
$port  = 47812
$root  = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path.TrimEnd('\', '/')
$index = Join-Path $root 'index.html'
$log   = Join-Path $env:TEMP 'e-diary-server.log'

function Test-Port([int]$p) { $c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', $p); return $true } catch { return $false } finally { $c.Close() } }
function Get-Root([int]$p) {
  # plain HTTP over a socket (no proxy settings involved): which folder does the server on this port show?
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $c.ReceiveTimeout = 3000; $c.SendTimeout = 3000; $c.Connect('127.0.0.1', $p)
    $st = $c.GetStream(); $q = [System.Text.Encoding]::ASCII.GetBytes("GET /__ediary_root HTTP/1.0`r`nHost: localhost`r`n`r`n"); $st.Write($q, 0, $q.Length)
    $t = (New-Object System.IO.StreamReader($st)).ReadToEnd(); $i = $t.IndexOf("`r`n`r`n")
    if ($t -match '^HTTP/\S+ 200' -and $i -ge 0) { return $t.Substring($i + 4).Trim() } else { return $null }
  } catch { return $null } finally { $c.Close() }
}
function Start-Server {
  Remove-Item $log -ErrorAction SilentlyContinue
  Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ('"' + (Join-Path $PSScriptRoot 'serve.ps1') + '"'), '-Quiet', '-Port', "$port", '-Log', ('"' + $log + '"'))
  for ($i = 0; $i -lt 50 -and -not (Test-Port $port); $i++) { Start-Sleep -Milliseconds 200 }
}

$ok = $false
if (Test-Port $port) {
  $r = Get-Root $port
  if ($r -and $r -ieq $root) { $ok = $true }
  elseif ($r) {
    # a diary server from another copy of the folder (an older unzip): stop it and serve this folder on the same address
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'serve\.ps1' -and $_.CommandLine -match "$port" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    for ($i = 0; $i -lt 25 -and (Test-Port $port); $i++) { Start-Sleep -Milliseconds 200 }
    Start-Server; $ok = ((Get-Root $port) -ieq $root)
  }
} else { Start-Server; $ok = ((Get-Root $port) -ieq $root) }

if ($ok) { $url = "http://localhost:$port/index.html" }
else {
  $why = if (Test-Path $log) { Get-Content $log -Raw } else { "Another program is using port $port, or the server did not start." }
  $sh = New-Object -ComObject WScript.Shell
  $null = $sh.Popup("E-Diary could not start its address http://localhost:$port, so it opens as a file now. It still works, but its data there is separate, and Google sign-in needs the address.`n`nReason:`n$why", 0, 'E-Diary', 48)
  $url = ([System.Uri]$index).AbsoluteUri
}

function Find-Browser([string]$exe) {
  foreach ($hive in 'HKCU:', 'HKLM:') { $p = (Get-ItemProperty "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$exe").'(default)'; if ($p -and (Test-Path $p)) { return $p } }
  foreach ($p in @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "$env:LocalAppData\Google\Chrome\Application\chrome.exe")) { if ($p -and (Test-Path $p) -and $p -match [regex]::Escape($exe)) { return $p } }
  return $null
}
$b = Find-Browser 'msedge.exe'; if (-not $b) { $b = Find-Browser 'chrome.exe' }
if ($b) { Start-Process -FilePath $b -ArgumentList @("--app=$url") } else { Start-Process $url }
