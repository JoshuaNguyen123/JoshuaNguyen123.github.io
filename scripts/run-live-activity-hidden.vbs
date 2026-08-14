Option Explicit

Dim fileSystem, shell, scriptDirectory, runner, powerShell, command, exitCode

Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
runner = fileSystem.BuildPath(scriptDirectory, "run-live-activity.ps1")
powerShell = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
command = Quote(powerShell) & " -NoProfile -NonInteractive -ExecutionPolicy Bypass -File " & Quote(runner)

exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
