@echo off
cd /d C:\Users\olive\Projects\viral-visitor-vl
node scripts\email-new-referral-alerts.mjs >> "%USERPROFILE%\.grok\logs\viralrefer-gmail-alerts.log" 2>&1
