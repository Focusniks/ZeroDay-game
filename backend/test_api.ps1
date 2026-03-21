param (
    [string]$Path = "/health"
)

$tcp = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 8000)
$stream = $tcp.GetStream()
$request = "GET $Path HTTP/1.1`r`nHost: 127.0.0.1:8000`r`nConnection: close`r`n`r`n"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($request)
$stream.Write($bytes, 0, $bytes.Length)
$stream.Flush()
$reader = New-Object System.IO.StreamReader($stream)
$response = $reader.ReadToEnd()
Write-Host $response
$tcp.Close()
