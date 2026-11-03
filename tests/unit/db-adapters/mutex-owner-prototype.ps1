param([Parameter(Mandatory)][string]$MutexName, [switch]$Hold)
$mutex = [System.Threading.Mutex]::new($false, $MutexName)
$owned = $false
try {
    try { $owned = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $owned = $true }
    if (-not $owned) { exit 2 }
    [Console]::Out.WriteLine('acquired')
    [Console]::Out.Flush()
    if ($Hold) { while ($true) { Start-Sleep -Seconds 1 } }
} finally {
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
