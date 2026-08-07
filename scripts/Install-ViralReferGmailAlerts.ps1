$ErrorActionPreference = "Stop"
$TaskName = "Nova-ViralRefer-Gmail-Alerts"
$Repo = "C:\Users\olive\Projects\viral-visitor-vl"
$Wrapper = Join-Path $Repo "scripts\run-email-referral-alerts.cmd"
$Secrets = Join-Path $env:USERPROFILE ".grok\secrets\viralrefer-gmail.env"
$LogDir = Join-Path $env:USERPROFILE ".grok\logs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $Secrets) | Out-Null

if (-not (Test-Path $Secrets)) {
  @(
    "GMAIL_USER=oliversenterprises@gmail.com"
    "ALERT_TO=oliversenterprises@gmail.com"
    "GMAIL_APP_PASSWORD=PASTE_APP_PASSWORD_HERE"
  ) | Set-Content -Path $Secrets -Encoding UTF8
  Write-Host "Created secrets file - add App Password"
}

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$Wrapper`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "OK installed $TaskName"
Get-ScheduledTask -TaskName $TaskName | Format-List TaskName, State
