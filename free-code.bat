@echo off
:: Set your API key and preferred model here, or use environment variables.
:: Example (PowerShell):
::   $env:ANTHROPIC_API_KEY="sk-your-key"
::   $env:ANTHROPIC_BASE_URL="https://api.anthropic.com"
:: Or use --login to authenticate interactively.
"%~dp0cli.exe" --model claude %*
