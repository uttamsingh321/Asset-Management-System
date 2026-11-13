import re
import socket
from typing import Dict, Any, Tuple
from django.http import HttpRequest


def parse_device_and_browser(request: HttpRequest) -> Dict[str, Any]:
    """
    Extracts device type (Desktop/Laptop/Tablet/Mobile), operating system,
    browser name & version, client IP address, and client hostname.
    Supports user-agent analysis, Sec-CH-UA client hints, and custom client telemetry headers.
    """
    ua = request.META.get('HTTP_USER_AGENT', '')
    sec_ch_ua_mobile = request.META.get('HTTP_SEC_CH_UA_MOBILE', '')
    sec_ch_ua_platform = request.META.get('HTTP_SEC_CH_UA_PLATFORM', '')
    client_device_header = request.META.get('HTTP_X_DEVICE_TYPE', '')

    device_type = _detect_device_type(ua, sec_ch_ua_mobile, client_device_header)
    os_name = _detect_os(ua, sec_ch_ua_platform)
    browser_name = _detect_browser(ua)
    client_ip, hostname = _get_client_ip_and_hostname(request)

    return {
        "device_type": device_type,
        "os": os_name,
        "browser": browser_name,
        "client_ip": client_ip,
        "hostname": hostname,
        "user_agent": ua,
    }


def _detect_device_type(ua: str, sec_mobile: str, client_override: str = "") -> str:
    """
    Identifies whether the device is Desktop, Laptop, Tablet, or Mobile.
    """
    if client_override in ["Desktop", "Laptop", "Tablet", "Mobile"]:
        return client_override

    ua_lower = ua.lower()

    # 1. Tablets
    tablet_patterns = [
        r'ipad',
        r'tablet',
        r'android(?!.*mobile)',
        r'kindle',
        r'silk',
        r'playbook',
        r'sm-t\d+',
        r'tab\b',
    ]
    for pat in tablet_patterns:
        if re.search(pat, ua_lower):
            return "Tablet"

    # 2. Mobiles
    if sec_mobile == '?1':
        # Sec-CH-UA-Mobile says it's mobile/handheld
        return "Mobile"

    mobile_patterns = [
        r'iphone',
        r'ipod',
        r'mobile',
        r'android.*mobile',
        r'blackberry',
        r'opera mini',
        r'windows phone',
        r'iemobile',
        r'pixel\b',
        r'samsung\b.*mobile',
    ]
    for pat in mobile_patterns:
        if re.search(pat, ua_lower):
            return "Mobile"

    # 3. Laptop vs Desktop distinction
    # If the user agent indicates a laptop (e.g. MacBook, ThinkPad, Latitude, Chromebook, Surface, or battery hint)
    laptop_patterns = [
        r'macbook',
        r'chromebook',
        r'cros',
        r'thinkpad',
        r'laptop',
        r'latitude',
        r'precision mobile',
        r'surface\s+laptop',
    ]
    for pat in laptop_patterns:
        if re.search(pat, ua_lower):
            return "Laptop"

    # If Mac without 'MacBook' in UA, or standard desktop Windows/Linux
    if any(k in ua_lower for k in ['windows nt', 'x11; linux', 'macintosh', 'crkey']):
        return "Desktop"

    return "Desktop"


def _detect_os(ua: str, sec_platform: str = "") -> str:
    """
    Identifies OS name and major version.
    """
    ua_lower = ua.lower()

    if 'windows nt 10.0' in ua_lower:
        return "Windows 10/11"
    elif 'windows nt 6.3' in ua_lower:
        return "Windows 8.1"
    elif 'windows nt 6.2' in ua_lower:
        return "Windows 8"
    elif 'windows nt 6.1' in ua_lower:
        return "Windows 7"
    elif 'windows' in ua_lower:
        return "Windows"

    if 'iphone os' in ua_lower or 'ipad' in ua_lower:
        match = re.search(r'os (\d+[_.]\d+)', ua_lower)
        ver = match.group(1).replace('_', '.') if match else ''
        return f"iOS {ver}".strip()

    if 'mac os x' in ua_lower or 'macintosh' in ua_lower:
        match = re.search(r'mac os x (\d+[_.]\d+)', ua_lower)
        ver = match.group(1).replace('_', '.') if match else ''
        return f"macOS {ver}".strip()

    if 'android' in ua_lower:
        match = re.search(r'android (\d+([._]\d+)?)', ua_lower)
        ver = match.group(1).replace('_', '.') if match else ''
        return f"Android {ver}".strip()

    if 'cros' in ua_lower:
        return "ChromeOS"

    if 'ubuntu' in ua_lower:
        return "Ubuntu Linux"

    if 'linux' in ua_lower:
        return "Linux"

    if sec_platform:
        return sec_platform.replace('"', '').strip()

    return "Unknown OS"


def _detect_browser(ua: str) -> str:
    """
    Identifies browser name and version.
    """
    ua_lower = ua.lower()

    if 'edg/' in ua_lower:
        match = re.search(r'edg/(\d+([._]\d+)?)', ua_lower)
        ver = match.group(1) if match else ''
        return f"Microsoft Edge {ver}".strip()

    if 'opr/' in ua_lower or 'opera' in ua_lower:
        match = re.search(r'(?:opr|opera)/(\d+([._]\d+)?)', ua_lower)
        ver = match.group(1) if match else ''
        return f"Opera {ver}".strip()

    if 'chrome/' in ua_lower:
        match = re.search(r'chrome/(\d+([._]\d+)?)', ua_lower)
        ver = match.group(1) if match else ''
        return f"Chrome {ver}".strip()

    if 'firefox/' in ua_lower:
        match = re.search(r'firefox/(\d+([._]\d+)?)', ua_lower)
        ver = match.group(1) if match else ''
        return f"Firefox {ver}".strip()

    if 'safari/' in ua_lower and 'version/' in ua_lower:
        match = re.search(r'version/(\d+([._]\d+)?)', ua_lower)
        ver = match.group(1) if match else ''
        return f"Safari {ver}".strip()

    return "Standard Browser"


def _get_client_ip_and_hostname(request: HttpRequest) -> Tuple[str, str]:
    """
    Extracts client IP address and resolves client hostname.
    """
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        ip = x_forwarded.split(',')[0].strip()
    else:
        ip = request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR') or '127.0.0.1'

    # Check for client-provided hostname header
    hostname = request.META.get('HTTP_X_CLIENT_HOSTNAME', '').strip()
    if not hostname:
        if ip in ['127.0.0.1', '::1', 'localhost']:
            hostname = 'localhost'
        else:
            try:
                # Fast reverse DNS with timeout
                socket.setdefaulttimeout(0.1)
                hostname = socket.gethostbyaddr(ip)[0]
            except Exception:
                hostname = f"host-{ip.replace('.', '-').replace(':', '-')}"

    return ip, hostname
