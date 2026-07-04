# Set your API key via environment variable before running this script.
# Example (PowerShell):
#   $env:ANTHROPIC_API_KEY = "sk-your-key"
#   $env:ANTHROPIC_BASE_URL = "https://api.anthropic.com"
# Or use --login to authenticate interactively.
& "$PSScriptRoot\cli.exe" @args
