# Read-only helper: send plain-text email via Gmail SMTP (App Password required).
param(
  [Parameter(Mandatory = $true)][string]$From,
  [Parameter(Mandatory = $true)][string]$To,
  [Parameter(Mandatory = $true)][string]$Subject,
  [Parameter(Mandatory = $true)][string]$BodyFile,
  [Parameter(Mandatory = $true)][string]$AppPassword
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $BodyFile)) {
  throw "Body file not found: $BodyFile"
}
$body = Get-Content -LiteralPath $BodyFile -Raw -Encoding UTF8

# Strip spaces from Google app passwords (UI often shows xxxx xxxx xxxx xxxx)
$pass = ($AppPassword -replace '\s', '')
$secure = ConvertTo-SecureString $pass -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($From, $secure)

# Prefer MailKit-free .NET SmtpClient (Windows PowerShell 5.1 compatible)
$smtp = New-Object System.Net.Mail.SmtpClient('smtp.gmail.com', 587)
$smtp.EnableSsl = $true
$smtp.Credentials = New-Object System.Net.NetworkCredential($From, $pass)

$mail = New-Object System.Net.Mail.MailMessage
$mail.From = $From
$mail.To.Add($To) | Out-Null
$mail.Subject = $Subject
$mail.Body = $body
$mail.IsBodyHtml = $false

try {
  $smtp.Send($mail)
  Write-Output "SENT ok to=$To subject=$Subject"
}
finally {
  $mail.Dispose()
  $smtp.Dispose()
}
