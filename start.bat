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
for /f "delims=" %%a in ('node -v 2^>nul') do (
    set nodeVersion=%%a
)
if %nodeVersion% =="" (
    goto question
) else (
    echo Node.js seems to be installed.
    goto checkNodeVersion
)

:question
echo Node.js does not seem to be installed.
set /p answer=Do you want to download and install Node.js? (y/n):
if /i %answer%==y goto download
if /i %answer%==n goto endd

:download
echo Downloading Node.js(V18.15.0)...
curl -L https://nodejs.org/dist/v18.15.0/node-v18.15.0-x64.msi -o node.msi --progress-bar
echo Download complete.   
echo Please install Node.js using the downloaded file: node.msi
start node.msi
set /p nodeVersion=Do you have installed Node.js? (y/n):
if /i %nodeVersion%==y (
    del node.msi
    goto checkNodeVersion
)
if /i %nodeVersion%==n goto endd

:update
set updatequestion= Do you want to update Node.js(V18.15.0)? (y/n):
if /i %updatequestion%==y goto download
if /i %updatequestion%==n goto endd

:checkNodeVersion
echo Checking Node.js version...
if %nodeVersion:~1,2% gtr 14 (
    echo Node.js version is OK.
    goto startProject 
) else (
    echo Your Node.js version is too low.This project requires Node.js version 14 or higher.
    goto update
)

:startProject
echo Starting project...
call npm i
call npm run start

:endd