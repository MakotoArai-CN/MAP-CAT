@echo off
title MAP-CAT

ping -n 1 www.baidu.com >nul
if %errorlevel% == 0 (
    goto begin
) else (
    echo Network is NOT connected.
    goto endd
)

:begin
for /f "delims=" %%a in ('bun -v 2^>nul') do (
    set bunVersion=%%a
)
if "%bunVersion%"=="" (
    goto question
) else (
    echo Bun.js seems to be installed.
    goto startProject
)

:question
echo Bun.js does not seem to be installed.
set /p answer=Do you want to download and install Bun.js? (y/n):
if /i %answer%==y goto download
if /i %answer%==n goto endd

:download
echo Installing Bun.js using PowerShell...
powershell -Command "irm bun.sh/install.ps1|iex"
echo Installation complete.
goto begin

:startProject
echo Starting project...
call bun install
cls
call bun run start

:endd