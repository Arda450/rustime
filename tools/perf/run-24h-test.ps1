<#
.SYNOPSIS
  24-Stunden-Dauerbetrieb- und Performance-Test fuer Rustime.

.DESCRIPTION
  Startet den Release-Build von Rustime und misst in einem festen Intervall
  RAM (Working Set) und CPU-Auslastung - getrennt nach:
    - App        : der/die Prozess(e) "tauri-app.exe"
    - WebView2   : die von der App gestarteten "msedgewebview2.exe"-Prozesse
    - Total      : Summe aus App + WebView2

  Zuordnung der Prozesse:
    - App:      Prozesse mit dem Exe-Namen der gestarteten App.
    - WebView2: msedgewebview2.exe-Prozesse, deren Kommandozeile
                "--webview-exe-name=<App-Exe>" enthaelt. Das ist noetig, weil
                WebView2 die Prozesse an einen eigenen Host haengt (sie sind
                KEINE Kindprozesse der App) und weil auf dem System auch
                fremde WebView2-Prozesse laufen (z. B. Windows-Suche).

  Alle Messpunkte werden in eine CSV geschrieben; am Ende gibt es eine
  Zusammenfassung (Min/Avg/Max) fuer App, WebView2 und Total.

  Hinweis: Vor dem Test andere Instanzen derselben App schliessen, damit die
  Zuordnung eindeutig bleibt. Damit die Polling-Loop laeuft, in der App ein
  Projekt waehlen und "Starte Tracking" druecken.

.PARAMETER Exe
  Pfad zur zu testenden Exe. Standard: target/release/tauri-app.exe.

.PARAMETER IntervalSec
  Mess-Intervall in Sekunden. Standard: 60.

.PARAMETER DurationHours
  Testdauer in Stunden. Standard: 24.

.PARAMETER OutCsv
  Pfad zur Ausgabe-CSV. Standard: tools/perf/results/rustime-<Zeitstempel>.csv.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools/perf/run-24h-test.ps1

.EXAMPLE
  # Kurzer Testlauf (5 Minuten, Messung alle 10 s):
  powershell -ExecutionPolicy Bypass -File tools/perf/run-24h-test.ps1 -DurationHours 0.0833 -IntervalSec 10
#>

param(
  [string]$Exe = "$PSScriptRoot\..\..\target\release\tauri-app.exe",
  [int]$IntervalSec = 60,
  [double]$DurationHours = 24,
  [string]$OutCsv = ""
)

$ErrorActionPreference = "Stop"

$WebViewProcName = "msedgewebview2.exe"

# CPU-Zeit eines Win32_Process in Millisekunden (Kernel + User, Einheit 100 ns).
function Get-CpuMs {
  param($CimProc)
  return ([double]$CimProc.KernelModeTime + [double]$CimProc.UserModeTime) / 10000.0
}

# Ausgabepfad vorbereiten
if ([string]::IsNullOrWhiteSpace($OutCsv)) {
  $resultsDir = Join-Path $PSScriptRoot "results"
  if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir | Out-Null
  }
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutCsv = Join-Path $resultsDir "rustime-$stamp.csv"
}

# Exe pruefen
if (-not (Test-Path $Exe)) {
  Write-Error "Exe nicht gefunden: $Exe`nBitte zuerst 'npm run tauri build' im Ordner tauri-app ausfuehren."
  exit 1
}
$Exe = (Resolve-Path $Exe).Path
$AppExeName = [System.IO.Path]::GetFileName($Exe)   # z. B. tauri-app.exe

Write-Host "=== Rustime 24h-Performance-Test ===" -ForegroundColor Cyan
Write-Host "Exe:         $Exe"
Write-Host "App-Prozess: $AppExeName"
Write-Host "Intervall:   $IntervalSec s"
Write-Host "Dauer:       $DurationHours h"
Write-Host "CSV:         $OutCsv"
Write-Host ""

# Sammelt die aktuellen App- und WebView2-Prozesse (als Win32_Process-Objekte).
function Get-TrackedProcesses {
  param([string]$AppExe, [string]$WvName)
  $filter = "Name='$AppExe' OR Name='$WvName'"
  $procs = Get-CimInstance Win32_Process -Filter $filter -ErrorAction SilentlyContinue
  $app = New-Object System.Collections.Generic.List[object]
  $wv = New-Object System.Collections.Generic.List[object]
  foreach ($p in $procs) {
    if ($p.Name -eq $AppExe) {
      $app.Add($p)
    }
    elseif ($p.Name -eq $WvName -and $p.CommandLine -and ($p.CommandLine -like "*--webview-exe-name=$AppExe*")) {
      $wv.Add($p)
    }
  }
  return [pscustomobject]@{ App = $app; WebView = $wv }
}

# Startzeit messen
Write-Host "Starte App und messe Startzeit..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process $Exe -PassThru
$sw.Stop()
$startMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 0)
Write-Host ("Prozess gestartet (PID {0}) - Startzeit Prozess: {1} ms" -f $proc.Id, $startMs)
Write-Host "WICHTIG: Jetzt in der App ein Projekt waehlen und 'Starte Tracking' druecken." -ForegroundColor Magenta
Write-Host ""

$cores = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$end = (Get-Date).AddHours($DurationHours)

# CSV-Header
"timestamp,app_ram_mb,app_cpu,webview_ram_mb,webview_cpu,total_ram_mb,total_cpu,app_procs,webview_procs" |
  Out-File -FilePath $OutCsv -Encoding utf8

$samples = New-Object System.Collections.Generic.List[object]
$crashed = $false

# CPU-Baseline (verbrauchte Prozessorzeit je PID) vor der ersten Messung setzen.
$prevCpu = @{}
$tracked = Get-TrackedProcesses -AppExe $AppExeName -WvName $WebViewProcName
foreach ($p in $tracked.App)     { $prevCpu[[int]$p.ProcessId] = Get-CpuMs $p }
foreach ($p in $tracked.WebView) { $prevCpu[[int]$p.ProcessId] = Get-CpuMs $p }
$prevTime = Get-Date

Write-Host "Messung laeuft. Zum Abbrechen Strg+C druecken." -ForegroundColor Green

while ((Get-Date) -lt $end) {
  Start-Sleep -Seconds $IntervalSec

  $tracked = Get-TrackedProcesses -AppExe $AppExeName -WvName $WebViewProcName
  $appProcs = $tracked.App
  $wvProcs = $tracked.WebView

  # Absturz: kein App-Prozess mehr vorhanden
  if ($appProcs.Count -eq 0) {
    $crashed = $true
    $msg = "ABSTURZ oder Beendigung erkannt um $(Get-Date -Format o)"
    Write-Host $msg -ForegroundColor Red
    $msg | Out-File -FilePath $OutCsv -Append -Encoding utf8
    break
  }

  $now = Get-Date
  $elapsedSec = ($now - $prevTime).TotalSeconds
  if ($elapsedSec -le 0) { $elapsedSec = $IntervalSec }

  $newCpu = @{}

  # RAM + CPU je Gruppe
  $appRam = 0.0; $appCpuMsDelta = 0.0
  foreach ($p in $appProcs) {
    $appRam += [double]$p.WorkingSetSize / 1MB
    $curMs = Get-CpuMs $p
    $prev = if ($prevCpu.ContainsKey([int]$p.ProcessId)) { $prevCpu[[int]$p.ProcessId] } else { $curMs }
    $d = $curMs - $prev
    if ($d -gt 0) { $appCpuMsDelta += $d }
    $newCpu[[int]$p.ProcessId] = $curMs
  }

  $wvRam = 0.0; $wvCpuMsDelta = 0.0
  foreach ($p in $wvProcs) {
    $wvRam += [double]$p.WorkingSetSize / 1MB
    $curMs = Get-CpuMs $p
    $prev = if ($prevCpu.ContainsKey([int]$p.ProcessId)) { $prevCpu[[int]$p.ProcessId] } else { $curMs }
    $d = $curMs - $prev
    if ($d -gt 0) { $wvCpuMsDelta += $d }
    $newCpu[[int]$p.ProcessId] = $curMs
  }

  $prevCpu = $newCpu
  $prevTime = $now

  $appCpu = [math]::Round((($appCpuMsDelta / 1000.0) / $elapsedSec / $cores) * 100, 2)
  $wvCpu = [math]::Round((($wvCpuMsDelta / 1000.0) / $elapsedSec / $cores) * 100, 2)
  $appRam = [math]::Round($appRam, 2)
  $wvRam = [math]::Round($wvRam, 2)
  $totRam = [math]::Round($appRam + $wvRam, 2)
  $totCpu = [math]::Round($appCpu + $wvCpu, 2)

  $ts = Get-Date -Format o
  "$ts,$appRam,$appCpu,$wvRam,$wvCpu,$totRam,$totCpu,$($appProcs.Count),$($wvProcs.Count)" |
    Out-File -FilePath $OutCsv -Append -Encoding utf8

  $samples.Add([pscustomobject]@{
      AppRam = $appRam; AppCpu = $appCpu
      WvRam  = $wvRam;  WvCpu  = $wvCpu
      TotRam = $totRam; TotCpu = $totCpu
    })

  Write-Host ("[{0}] App: {1} MB / {2} % ({3} P)   WebView2: {4} MB / {5} % ({6} P)   Total: {7} MB / {8} %" -f `
      (Get-Date -Format "HH:mm:ss"), $appRam, $appCpu, $appProcs.Count, $wvRam, $wvCpu, $wvProcs.Count, $totRam, $totCpu)
}

# Zusammenfassung
Write-Host ""
Write-Host "=== Zusammenfassung ===" -ForegroundColor Cyan
Write-Host ("Startzeit Prozess:  {0} ms" -f $startMs)
Write-Host ("Messpunkte:         {0}" -f $samples.Count)

if ($samples.Count -gt 0) {
  $appRamS = $samples.AppRam | Measure-Object -Minimum -Maximum -Average
  $wvRamS  = $samples.WvRam  | Measure-Object -Minimum -Maximum -Average
  $totRamS = $samples.TotRam | Measure-Object -Minimum -Maximum -Average
  $appCpuS = $samples.AppCpu | Measure-Object -Minimum -Maximum -Average
  $wvCpuS  = $samples.WvCpu  | Measure-Object -Minimum -Maximum -Average
  $totCpuS = $samples.TotCpu | Measure-Object -Minimum -Maximum -Average

  Write-Host ""
  Write-Host "RAM (MB)      min / avg / max" -ForegroundColor Yellow
  Write-Host ("  App:      {0,8:N2} / {1,8:N2} / {2,8:N2}" -f $appRamS.Minimum, $appRamS.Average, $appRamS.Maximum)
  Write-Host ("  WebView2: {0,8:N2} / {1,8:N2} / {2,8:N2}" -f $wvRamS.Minimum,  $wvRamS.Average,  $wvRamS.Maximum)
  Write-Host ("  Total:    {0,8:N2} / {1,8:N2} / {2,8:N2}" -f $totRamS.Minimum, $totRamS.Average, $totRamS.Maximum)

  Write-Host ""
  Write-Host "CPU (%)       min / avg / max" -ForegroundColor Yellow
  Write-Host ("  App:      {0,8:N2} / {1,8:N2} / {2,8:N2}" -f $appCpuS.Minimum, $appCpuS.Average, $appCpuS.Maximum)
  Write-Host ("  WebView2: {0,8:N2} / {1,8:N2} / {2,8:N2}" -f $wvCpuS.Minimum,  $wvCpuS.Average,  $wvCpuS.Maximum)
  Write-Host ("  Total:    {0,8:N2} / {1,8:N2} / {2,8:N2}" -f $totCpuS.Minimum, $totCpuS.Average, $totCpuS.Maximum)
}

Write-Host ""
if ($crashed) {
  Write-Host "Ergebnis: FEHLGESCHLAGEN - Prozess wurde vor Ablauf beendet." -ForegroundColor Red
} else {
  Write-Host "Ergebnis: BESTANDEN - App lief ueber die gesamte Dauer." -ForegroundColor Green
}

Write-Host ""
Write-Host "CSV gespeichert unter: $OutCsv"
Write-Host "Die App laeuft weiter und kann manuell geschlossen werden."
