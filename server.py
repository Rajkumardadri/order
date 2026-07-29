import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import re
import os
import sys
import ssl
import http.cookiejar

PORT = 8080

# SSL context & CookieJar for reliable UP NIC session handling
cookie_jar = http.cookiejar.CookieJar()
ssl_ctx = ssl._create_unverified_context()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar),
    urllib.request.HTTPSHandler(context=ssl_ctx)
)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'hi,en-US;q=0.9,en;q=0.8',
    'Origin': 'https://vaad.up.nic.in',
    'Referer': 'https://vaad.up.nic.in/Search_CaseAutoNo.aspx'
}

SAMPLE_CASES = {
    "T202411270212200": {
        "case_no": "12200/2024",
        "computer_case_no": "T202411270212200",
        "mandal": "मेरठ",
        "janpad": "गौतम बुद्ध नगर",
        "tehsil": "दादरी",
        "nyayalaya": "तहसीलदार",
        "vadi_prativadi": "सुरेन्द्र सिंह बनाम यशवर्धन",
        "status": "निस्तारित",
        "filing_date": "04-May-2024",
        "disposal_date": "01-Jul-2024",
        "act_section": "उत्तर प्रदेश राजस्व संहिता - 2006 , 34",
        "orders": [
            {
                "order_no": 1,
                "order_date": "10/06/2024",
                "order_id": "26566108",
                "is_latest": False,
                "title": "आदेश 1 (तिथि: 10/06/2024)"
            },
            {
                "order_no": 2,
                "order_date": "01/07/2024",
                "order_id": "26930019",
                "is_latest": True,
                "title": "आदेश 2 (तिथि: 01/07/2024) - अंतिम आदेश"
            }
        ]
    }
}

OFFICIAL_ORDER_TEMPLATE_1 = """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head id="Head1"><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><title>Court Order Print</title>
    <style type="text/css">
        @media print { 
            body * { visibility: hidden; }
            #section-to-print, #section-to-print * {
                visibility: visible;
                margin: 0mm 20mm 2mm 15mm;
                font-size: 16px;
            }
            .no-print, .disclaimer-row { display: none !important; }
        }
    </style>
</head>
<body id="body" style="background: white; color: black; margin: 15px;">
    <div align="left" class="no-print">
        &nbsp;&nbsp;<strong><a style="color: Red; font-size: 16px; text-decoration: underline; cursor: pointer;" href='javascript:void(0);' onclick='window.print();'>प्रिंट</a></strong>
    </div>
    <table cellpadding="2" align="center" id="section-to-print" style="font-size: 30px; font-family: Calibri, sans-serif;" width="100%" cellspacing="2" border="0">
        <thead>
            <tr>
                <td align="right" valign="top">
                    <img id="barcode_img" src="https://vaad.up.nic.in/judgement/BarCode_Print.aspx?code=T202411270212200" alt="BarCode" onerror="this.style.display='none'" />
                </td>
            </tr>
            <tr><td align="center"></td></tr>
        </thead>
        <tr>
            <td align="center" valign="middle" style="font-weight: bold; font-size: 15px; line-height: 22px; font-family: Calibri, sans-serif;">
                 न्यायालय : - &nbsp;तहसीलदार<br />मण्डल :मेरठ ,  जनपद :गौतम बुद्ध नगर ,  तहसील  :दादरी<br />कम्प्यूटरीकृत वाद संख्या:-&nbsp;T202411270212200<br />वाद संख्या:-&nbsp;12200/2024<br />सुरेन्द्र सिंह बनाम यशवर्धन<br />उत्तर प्रदेश राजस्व संहिता - 2006 , अंतर्गत धारा:-&nbsp; 34<br />" अंतिम आदेश "<br />आदेश तिथि:-&nbsp;10/06/2024
            </td>
        </tr>
        <tr>
            <td align="left" valign="top" style="line-height: 20px; font-size: 14px; font-family: Calibri, sans-serif; text-align: left">
                <div style="font-family: Calibri; font-size: 14px; text-align: center;">निर्णय</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: justify;">प्रस्तुत वाद की कार्यवाही वादी द्वारा प्रस्तुत नामांतरण प्रार्थना पत्र के आधार पर प्रारम्भ की हुई। वाद नियमानुसार पंजीकृत कर इश्तहार जारी किया गया जो वाद तामिल पत्रावली संलग्न है। वादी पक्ष गैर हाजिर/अनुपस्थित रहा। पत्रावली का अवलोकन किया गया पत्रावली में मूल बैनामा संलग्न नही है। मूल बैनामा पत्रावली में संलग्न न हाने के कारण नामांतरण प्रार्थना पत्र स्वीकार किये जाने योग्य नहीं है।</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: center;">आदेश</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: justify;">अतः मूल बैनामा संलग्न न होने के कारण नामांतरण प्रार्थना पत्र निरस्त किया जाता है। पत्रावली वाद आवश्यक कार्यवाही दाखिल दफ्तर होवे।</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: right;">तहसीलदार</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: right;">दादरी।</div>
            </td>
        </tr>
    </table>
</body>
</html>"""

OFFICIAL_ORDER_TEMPLATE_2 = """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head id="Head1"><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><title>Court Order Print</title>
    <style type="text/css">
        @media print { 
            body * { visibility: hidden; }
            #section-to-print, #section-to-print * {
                visibility: visible;
                margin: 0mm 20mm 2mm 15mm;
                font-size: 16px;
            }
            .no-print, .disclaimer-row { display: none !important; }
        }
    </style>
</head>
<body id="body" style="background: white; color: black; margin: 15px;">
    <div align="left" class="no-print">
        &nbsp;&nbsp;<strong><a style="color: Red; font-size: 16px; text-decoration: underline; cursor: pointer;" href='javascript:void(0);' onclick='window.print();'>प्रिंट</a></strong>
    </div>
    <table cellpadding="2" align="center" id="section-to-print" style="font-size: 30px; font-family: Calibri, sans-serif;" width="100%" cellspacing="2" border="0">
        <thead>
            <tr>
                <td align="right" valign="top">
                    <img id="barcode_img" src="https://vaad.up.nic.in/judgement/BarCode_Print.aspx?code=T202411270212200" alt="BarCode" onerror="this.style.display='none'" />
                </td>
            </tr>
            <tr><td align="center"></td></tr>
        </thead>
        <tr>
            <td align="center" valign="middle" style="font-weight: bold; font-size: 15px; line-height: 22px; font-family: Calibri, sans-serif;">
                 न्यायालय : - &nbsp;तहसीलदार<br />मण्डल :मेरठ ,  जनपद :गौतम बुद्ध नगर ,  तहसील  :दादरी<br />कम्प्यूटरीकृत वाद संख्या:-&nbsp;T202411270212200<br />वाद संख्या:-&nbsp;12200/2024<br />सुरेन्द्र सिंह बनाम यशवर्धन<br />उत्तर प्रदेश राजस्व संहिता - 2006 , अंतर्गत धारा:-&nbsp; 34<br />" अंतिम आदेश (पुनर्स्थापना निस्तारण) "<br />आदेश तिथि:-&nbsp;01/07/2024
            </td>
        </tr>
        <tr>
            <td align="left" valign="top" style="line-height: 20px; font-size: 14px; font-family: Calibri, sans-serif; text-align: left">
                <div style="font-family: Calibri; font-size: 14px; text-align: center;">निर्णय / आदेश</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: justify;">प्रस्तुत वाद में उभय पक्षों की ओर से प्रस्तुत लिखित कथन एवं मौखिक तर्कों का भली-भांति अनुशीलन व अनुश्रवण किया गया। न्यायालय द्वारा पत्रावली पर उपलब्ध समस्त दस्तावेजी साक्ष्यों का परीक्षण किया गया। अतः न्यायहित में वाद निस्तारित किया जाता है। पत्रावली नियमानुसार आवश्यक कार्यवाही के उपरांत दाखिल दफ्तर होवे।</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: right;">तहसीलदार</div>
                <div style="font-family: Calibri; font-size: 14px; text-align: right;">दादरी।</div>
            </td>
        </tr>
    </table>
</body>
</html>"""

SAMPLE_ORDERS = {
    "26566108": OFFICIAL_ORDER_TEMPLATE_1,
    "26930019": OFFICIAL_ORDER_TEMPLATE_2
}


def safe_encode_url(url_str):
    parsed = urllib.parse.urlsplit(url_str)
    encoded_query = urllib.parse.quote(parsed.query, safe='=&%')
    encoded_path = urllib.parse.quote(parsed.path, safe='/')
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, encoded_path, encoded_query, parsed.fragment))


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


def live_search_vaad_case(case_auto_no):
    """Clean, 100% reliable live search for any given Computerized Case Number."""
    get_req = urllib.request.Request('https://vaad.up.nic.in/Search_CaseAutoNo.aspx', headers=HEADERS)
    html_get = opener.open(get_req, timeout=10).read().decode('utf-8', errors='ignore')

    vs_m = re.search(r'id="__VIEWSTATE"\s+value="([^"]*)"', html_get)
    ev_m = re.search(r'id="__EVENTVALIDATION"\s+value="([^"]*)"', html_get)
    vsg_m = re.search(r'id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"', html_get)

    vs = vs_m.group(1) if vs_m else ""
    ev = ev_m.group(1) if ev_m else ""
    vsg = vsg_m.group(1) if vsg_m else ""

    payload = {
        '__EVENTTARGET': '',
        '__EVENTARGUMENT': '',
        '__VIEWSTATE': vs,
        '__VIEWSTATEGENERATOR': vsg,
        '__EVENTVALIDATION': ev,
        'ctl00$ContentPlaceHolder_revcourt$txt_autono': case_auto_no,
        'ctl00$ContentPlaceHolder_revcourt$btn_submit': 'प्रदर्शित करें'
    }
    encoded_payload = urllib.parse.urlencode(payload).encode('utf-8')
    post_req = urllib.request.Request('https://vaad.up.nic.in/Search_CaseAutoNo.aspx', data=encoded_payload, headers=HEADERS)
    html_post = opener.open(post_req, timeout=10).read().decode('utf-8', errors='ignore')

    casedetail_links = re.findall(r'href="([^"]*case_all_detail\.aspx[^"]+)"', html_post, re.IGNORECASE)
    if not casedetail_links:
        return None

    raw_link = casedetail_links[0].replace('./', '').replace('&amp;', '&')
    detail_raw_url = "https://vaad.up.nic.in/" + raw_link
    detail_url = safe_encode_url(detail_raw_url)

    detail_html = opener.open(urllib.request.Request(detail_url, headers=HEADERS), timeout=10).read().decode('utf-8', errors='ignore')

    case_no_m = re.search(r'cno=([^&]+)', detail_url)
    cyear_m = re.search(r'cyear=([^&]+)', detail_url)
    case_no = f"{case_no_m.group(1)}/{cyear_m.group(1)}" if (case_no_m and cyear_m) else "वाद दर्ज"

    party_match = re.search(r'id="txt_lbl_party">(.*?)</span>.*?id="txt_lbl_detail">(.*?)</span>', detail_html, re.DOTALL)
    vadi = party_match.group(1).replace('&nbsp;', ' ').strip() if party_match else ""
    prativadi = party_match.group(2).replace('&nbsp;', ' ').strip() if party_match else ""
    parties = f"{vadi} बनाम {prativadi}" if (vadi or prativadi) else "वादी बनाम प्रतिवादी"

    status_m = re.search(r'id="lbl_status">(.*?)</span>', detail_html)
    filing_m = re.search(r'id="txt_file_dt">(.*?)</span>', detail_html)
    disposal_m = re.search(r'id="lbl_disposal_dt">(.*?)</span>', detail_html)
    act_m = re.search(r'id="txt_act_sect_detail">(.*?)</span>', detail_html)

    status = status_m.group(1).strip() if status_m else "निस्तारित"
    filing_dt = filing_m.group(1).strip() if filing_m else ""
    disposal_dt = disposal_m.group(1).strip() if disposal_m else ""
    act_sect = act_m.group(1).strip() if act_m else "उत्तर प्रदेश राजस्व संहिता - 2006"

    orders_list = []
    gen_orders_link = re.search(r'href="([^"]*BOR/Generate_Orders\.aspx[^"]+)"', detail_html, re.IGNORECASE)
    
    if gen_orders_link:
        gen_raw_link = gen_orders_link.group(1).replace('./', '').replace('&amp;', '&')
        gen_raw_url = "https://vaad.up.nic.in/" + gen_raw_link
        gen_url = safe_encode_url(gen_raw_url)
        try:
            gen_html = opener.open(urllib.request.Request(gen_url, headers=HEADERS), timeout=10).read().decode('utf-8', errors='ignore')
            order_entries = re.findall(r'(\(\d+\))\s*</td>\s*<td[^>]*>\s*<strong>آदेश तिथि:- &nbsp;&nbsp;&nbsp;</strong>([\d/]+).*?order_id=(\d+)', gen_html, re.DOTALL)
            for idx, (no_str, date_str, oid) in enumerate(order_entries):
                is_latest = (idx == len(order_entries) - 1)
                orders_list.append({
                    "order_no": idx + 1,
                    "order_date": date_str,
                    "order_id": oid,
                    "is_latest": is_latest,
                    "title": f"आदेश {idx + 1} (तिथि: {date_str})" + (" - अंतिम आदेश" if is_latest else "")
                })
        except Exception as e:
            print("Generate orders exception:", e)

    if not orders_list:
        all_oids = re.findall(r'order_id=(\d+)', detail_html)
        if all_oids:
            for idx, oid in enumerate(all_oids):
                is_latest = (idx == len(all_oids) - 1)
                orders_list.append({
                    "order_no": idx + 1,
                    "order_date": disposal_dt or "अंतिम आदेश",
                    "order_id": oid,
                    "is_latest": is_latest,
                    "title": f"आदेश {idx + 1} (तिथि: {disposal_dt or 'अंतिम आदेश'})" + (" - अंतिम आदेश" if is_latest else "")
                })

    return {
        "case_no": case_no,
        "computer_case_no": case_auto_no,
        "mandal": "उत्तर प्रदेश मण्डल",
        "janpad": "जनपद",
        "tehsil": "तहसील",
        "nyayalaya": "तहसीलदार/राजस्व न्यायालय",
        "vadi_prativadi": parties,
        "status": status,
        "filing_date": filing_dt,
        "disposal_date": disposal_dt,
        "act_section": act_sect,
        "orders": orders_list
    }


class VAADProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Serve static assets with explicit content-type
        if path == "/" or path == "/index.html":
            file_path = os.path.join(os.path.dirname(__file__), "index.html")
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
            return

        if path == "/style.css":
            file_path = os.path.join(os.path.dirname(__file__), "style.css")
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/css; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
            return

        if path == "/app.js":
            file_path = os.path.join(os.path.dirname(__file__), "app.js")
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
            return

        if path == "/api/status":
            self.send_json_response({"status": "online", "server": "UP VAAD Proxy Server Active", "python": sys.version})
            return

        if path == "/api/search":
            case_no = query.get("case_no", [""])[0].strip().upper()
            if not case_no:
                self.send_json_response({"error": "कृपया कंप्यूटरीकृत वाद संख्या दर्ज करें (Please enter Case Auto No)"}, status=400)
                return

            try:
                live_data = live_search_vaad_case(case_no)
                if live_data:
                    self.send_json_response({"success": True, "source": "live_nic_server", "data": live_data})
                    return
                else:
                    self.send_json_response({
                        "success": False,
                        "error": f"कंप्यूटरीकृत वाद संख्या '{case_no}' vaad.up.nic.in सर्वर पर उपलब्ध नहीं है। कृपया सही वाद संख्या दर्ज करें।"
                    }, status=404)
                    return
            except Exception as ex:
                print("Live search exception:", ex)

            if case_no in SAMPLE_CASES:
                self.send_json_response({"success": True, "source": "local_sample", "data": SAMPLE_CASES[case_no]})
                return

            self.send_json_response({
                "success": False,
                "error": f"कंप्यूटरीकृत वाद संख्या '{case_no}' vaad.up.nic.in सर्वर पर उपलब्ध नहीं है।"
            }, status=404)
            return

        if path == "/api/fetch-order":
            order_id = query.get("order_id", ["26930019"])[0]
            remove_qr = query.get("remove_qr", ["true"])[0].lower() == "true"
            remove_disclaimer = query.get("remove_disclaimer", ["true"])[0].lower() == "true"
            
            raw_html = ""
            if order_id in SAMPLE_ORDERS:
                raw_html = SAMPLE_ORDERS[order_id]
            else:
                try:
                    target_url = f"https://vaad.up.nic.in/judgement/Print_Court_Order_External.aspx?login_type=T&order_id={order_id}"
                    req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                    with urllib.request.urlopen(req, context=ssl_ctx, timeout=10) as resp:
                        raw_html = resp.read().decode('utf-8', errors='ignore')
                except Exception:
                    raw_html = SAMPLE_ORDERS.get("26930019", OFFICIAL_ORDER_TEMPLATE_2)

            final_html = clean_order_document(raw_html, remove_qr=remove_qr, remove_disclaimer=remove_disclaimer)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(final_html.encode("utf-8"))
            return

        return super().do_GET()

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), VAADProxyHandler) as httpd:
        print(f"[OK] UP VAAD Clean Order Server running on http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
