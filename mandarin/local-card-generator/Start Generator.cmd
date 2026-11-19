@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    py -3.13 -m venv .venv || goto failed
)
if not exist ".venv\card-generator-ready" (
    ".venv\Scripts\python.exe" -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cu128
    if errorlevel 1 (
        echo CUDA setup did not finish. Installing the slower CPU version.
        ".venv\Scripts\python.exe" -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cpu || goto failed
    )
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto failed
    ".venv\Scripts\python.exe" server.py --download-model || goto failed
    type nul > ".venv\card-generator-ready"
)
if not exist "research-cache\cedict.gz" goto install_research
if not exist "research-cache\hanzi.jsonl" goto install_research
goto start

:install_research
".venv\Scripts\python.exe" server.py --download-research
if errorlevel 1 echo Research setup could not finish. The studio can still open and accept manual card details.

:start
".venv\Scripts\python.exe" server.py --open-browser
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo The card generator could not start. See the error above.
pause
exit /b 1
