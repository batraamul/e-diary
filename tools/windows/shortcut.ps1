# E-Diary: puts an "E-Diary" icon on the Desktop and in the Start menu that opens the diary (start.ps1).
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ws = New-Object -ComObject WScript.Shell
$targets = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))
foreach ($dir in $targets) {
  $lnk = $ws.CreateShortcut((Join-Path $dir 'E-Diary.lnk'))
  $lnk.TargetPath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
  $lnk.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $PSScriptRoot 'start.ps1') + '"'
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = (Join-Path $root 'icons\e-diary.ico') + ',0'
  $lnk.WindowStyle = 7
  $lnk.Description = 'E-Diary Planner'
  $lnk.Save()
}
$null = $ws.Popup("Done: E-Diary is on your Desktop and in the Start menu (right-click it there to pin it to the taskbar).", 0, 'E-Diary', 64)
