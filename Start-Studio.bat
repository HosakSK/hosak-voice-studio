@echo off
title Piper Voice-Over Studio
chcp 65001 > nul
cls

echo =========================================================
echo    [STUDIO] Piper TTS Voice-Over Studio (Local Runner)
echo =========================================================
echo.
echo Starting local WebAssembly server and opening browser...
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    node serve.js
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        python serve.py
    ) else (
        echo Opening index.html directly in default browser...
        start index.html
    )
)

pause