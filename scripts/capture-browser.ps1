Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$src = @"
using System;
using System.Runtime.InteropServices;

public class DwmHelper {
    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT rect, int cbSize);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
Add-Type -TypeDefinition $src -ErrorAction SilentlyContinue

# Find the browser window handle by process name (not title, which can match VS Code)
$proc = Get-Process | Where-Object {
    $_.ProcessName -match '^(chrome|msedge|firefox|brave)$' -and $_.MainWindowHandle -ne 0
} | Select-Object -First 1

if (-not $proc) {
    Write-Error "No browser window found"
    exit 1
}

$hwnd = $proc.MainWindowHandle
$rect = New-Object DwmHelper+RECT
[DwmHelper]::DwmGetWindowAttribute($hwnd, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf([type][DwmHelper+RECT])) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $w, $h))
$g.Dispose()
$bmp.Save($args[0], [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Saved ${w}x${h}: $($args[0])"
