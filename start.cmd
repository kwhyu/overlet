@echo off
rem Launch Desktop Mate Wannabe. Clears ELECTRON_RUN_AS_NODE just in case
rem some environments set it (which would make Electron run as plain Node).
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
call node_modules\.bin\electron.cmd .
