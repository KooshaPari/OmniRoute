@echo off
:loop
ping -n 301 127.0.0.1 >nul
echo AGENT_LOOP_TICK_proc {"prompt":"tick"}
goto loop
