import re
import ssl
import time
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler
from concurrent.futures import ThreadPoolExecutor

ssl_ctx = ssl._create_unverified_context()

def reformat_order_header_html(html_str):
    cleaned = html_str
    cleaned = re.sub(r'<br\s*/?>\s*पीठासीन अधिकारी का नाम:[^<]*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'पीठासीन अधिकारी का नाम:[^<]*<br\s*/?>\s*', '', cleaned, flags=re.IGNORECASE)

    def swap_act_section(m):
        act_part = m.group(1).strip()
        sec_part = m.group(2).strip()
        return f"{sec_part} , {act_part}"

    cleaned = re.sub(r'(उत्तर प्रदेश राजस्व संहिता\s*-[^,<\n]+)\s*,\s*(अंतर्गत धारा:[^<\n]+)', swap_act_section, cleaned, flags=re.IGNORECASE)

    def replace_header_td(match):
        attrs = match.group(1)
        content = match.group(2)
        raw_lines = re.split(r'<br\s*/?>|\n', content)
        
        mandal_line = ""
        court_line = ""
        case_no_line = ""
        parties_line = ""
        comp_no_line = ""
        act_sec_line = ""
        order_date_line = ""
        order_type_line = ""
        other_lines = []

        for line in raw_lines:
            sline = line.strip()
            if not sline:
                continue

            clean_sline = re.sub(r'&nbsp;', ' ', sline).strip()

            if 'पीठासीन अधिकारी का नाम' in clean_sline:
                continue
            elif clean_sline.startswith('मण्डल') or 'जनपद' in clean_sline:
                m = re.search(r'मण्डल\s*:?\s*-?\s*([^,]+),\s*जनपद\s*:?\s*-?\s*([^,]+),\s*तहसील\s*:?\s*-?\s*(.*)', clean_sline)
                if m:
                    m_val = m.group(1).strip()
                    j_val = m.group(2).strip()
                    t_val = m.group(3).strip()
                    mandal_line = f"मण्डल:- {m_val},जनपद:- {j_val},तहसील:- {t_val}"
                else:
                    mandal_line = clean_sline
            elif clean_sline.startswith('न्यायालय'):
                c_clean = re.sub(r'न्यायालय\s*:?\s*-?\s*', 'न्यायालय ', clean_sline)
                court_line = re.sub(r'\s+', ' ', c_clean).strip()
            elif clean_sline.startswith('कम्प्यूटरीकृत वाद संख्या') or clean_sline.startswith('कंप्यूटरीकृत वाद संख्या'):
                comp_no_line = sline
            elif clean_sline.startswith('वाद संख्या'):
                case_no_line = sline
            elif 'बनाम' in clean_sline:
                parts = clean_sline.split('बनाम', 1)
                vadi = parts[0].strip()
                prativadi = parts[1].strip()
                gap = '&nbsp;' * 22
                parties_line = f"{vadi}{gap}बनाम{gap}{prativadi}"
            elif 'उत्तर प्रदेश राजस्व संहिता' in clean_sline or 'अंतर्गत धारा' in clean_sline:
                act_sec_line = sline
            elif clean_sline.startswith('आदेश तिथि'):
                order_date_line = sline
            elif 'आदेश' in clean_sline and ('अंतिम' in clean_sline or 'अंतरिम' in clean_sline or '"' in clean_sline):
                order_type_line = re.sub(r'["\'”‘]', '', clean_sline).strip()
            else:
                other_lines.append(sline)

        new_lines = []
        if mandal_line: new_lines.append(mandal_line)
        if court_line: new_lines.append(court_line)
        if case_no_line: new_lines.append(case_no_line)
        if parties_line: new_lines.append(parties_line)
        if comp_no_line: new_lines.append(comp_no_line)
        if act_sec_line: new_lines.append(act_sec_line)
        if order_date_line: new_lines.append(order_date_line)
        if order_type_line: new_lines.append(order_type_line)
        new_lines.extend(other_lines)
        return f'<td{attrs}>{"<br />".join(new_lines)}</td>'

    pattern = r'<td([^>]*valign="middle"[^>]*)>(.*?"?न्यायालय.*?)</td>'
    return re.sub(pattern, replace_header_td, cleaned, flags=re.DOTALL | re.IGNORECASE)

def clean_order_document(html_str, remove_qr=True, remove_disclaimer=True):
    cleaned = html_str.replace('src="BarCode_Print.aspx', 'src="https://vaad.up.nic.in/judgement/BarCode_Print.aspx')
    cleaned = cleaned.replace('src="../QRCodeJs/', 'src="https://vaad.up.nic.in/QRCodeJs/')

    if remove_qr:
        cleaned = re.sub(r'<div id="qrcode">.*?</div>', '<div id="qrcode"></div>', cleaned, flags=re.DOTALL)
        cleaned = re.sub(r'var qrcode = new QRCode\(.*?\);', '', cleaned, flags=re.DOTALL)
        cleaned = re.sub(r'qrcode\.makeCode\(.*?\);', '', cleaned, flags=re.DOTALL)
        cleaned = re.sub(r'<img[^>]*class="[^"]*square-qr-code[^"]*"[^>]*>', '', cleaned, flags=re.IGNORECASE)

    if remove_disclaimer:
        cleaned = re.sub(r'<tr>\s*<td[^>]*>\s*<strong>\s*<u[^>]*>Disclaimer\s*:.*?</td>\s*</tr>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r'<div[^>]*>.*?Disclaimer\s*:.*?</div>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)

    cleaned = reformat_order_header_html(cleaned)

    css_injection = """
    <style>
        #qrcode, canvas, img[src*="QRCode"], .square-qr-code {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
        }
        @media print {
            #qrcode, canvas, img[src*="QRCode"], .square-qr-code, .disclaimer-box {
                display: none !important;
            }
            .no-print {
                display: none !important;
            }
        }
    </style>
    """
    return css_injection + cleaned

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)

        order_id = query.get("order_id", ["26930019"])[0]
        login_type = query.get("login_type", [""])[0] or ""
        remove_qr = query.get("remove_qr", ["true"])[0].lower() == "true"
        remove_disclaimer = query.get("remove_disclaimer", ["true"])[0].lower() == "true"

        raw_html = ""
        types_to_try = [login_type] if login_type else ["T", "NT"]
        if login_type == "T": types_to_try = ["T", "NT"]
        elif login_type == "NT": types_to_try = ["NT", "T"]

        def _fetch_order_worker(lt):
            target_url = f"https://vaad.up.nic.in/judgement/Print_Court_Order_External.aspx?login_type={lt}&order_id={order_id}"
            req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
            try:
                with urllib.request.urlopen(req, context=ssl_ctx, timeout=3) as resp:
                    content = resp.read().decode('utf-8', errors='ignore')
                    if 'अपलोड नहीं किया गया' not in content and 'अपलोड करें' not in content and len(content) > 500:
                        return content
            except Exception:
                pass
            return None

        with ThreadPoolExecutor(max_workers=len(types_to_try)) as executor:
            futures = [executor.submit(_fetch_order_worker, lt) for lt in types_to_try]
            for fut in futures:
                res = fut.result()
                if res:
                    raw_html = res
                    break

        if not raw_html:
            raw_html = "<h2>आदेश लोड नहीं हो सका अथवा उपलब्ध नहीं है।</h2>"

        final_html = clean_order_document(raw_html, remove_qr=remove_qr, remove_disclaimer=remove_disclaimer)

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(final_html.encode("utf-8"))
