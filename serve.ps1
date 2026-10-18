# starboy static server — plain sockets, no admin / no URL ACL needed.
# Serves this folder on http://<this-machine-ip>:8765/ so other devices on
# the same network (your other laptop) can open the site.
#   run:  powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
#   stop: Ctrl+C, or  Get-Process powershell | Stop-Process  (careful)
$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$port  = 8765
$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Output "starboy serving $root on port $port (all interfaces)"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $stream.WriteTimeout = 15000
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    while ($true) { $l = $reader.ReadLine(); if ($l -eq $null -or $l -eq '') { break } }
    if (-not $requestLine) { $client.Close(); continue }

    $target = ($requestLine -split ' ')[1]
    if (-not $target) { $target = '/' }
    $path = $target.Split('?')[0].TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = Join-Path $root $path

    if (Test-Path -LiteralPath $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext   = [System.IO.Path]::GetExtension($file).ToLower()
      $ct    = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $head  = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
      $hb    = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($hb, 0, $hb.Length)
      $stream.Write($bytes, 0, $bytes.Length)
    } else {
      $hb = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 404 Not Found`r`nContent-Length: 0`r`nConnection: close`r`n`r`n")
      $stream.Write($hb, 0, $hb.Length)
    }
    $stream.Flush()
  } catch {
  } finally {
    $client.Close()
  }
}
