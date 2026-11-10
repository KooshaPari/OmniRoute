@echo off
call npm run typecheck:core > "%TEMP%\tcoy.txt" 2>&1
set "EC=%errorlevel%"
echo EC=%EC%
type "%TEMP%\tcoy.txt"
del "%TEMP%\tcoy.txt" 2>nul
exit /b %EC%
