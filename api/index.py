from http.server import BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import re
import ssl
import http.cookiejar
import time

# In-Memory High Speed Caching
CASE_CACHE = {}      # case_auto_no -> (timestamp, data)
ORDER_CACHE = {}     # cache_key -> (timestamp, html_str)
CACHE_TTL = 600      # 10 minutes cache for case details
ORDER_TTL = 900      # 15 minutes cache for clean order documents

cookie_jar = http.cookiejar.CookieJar()
ssl_ctx = ssl._create_unverified_context()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar),
    urllib.request.HTTPSHandler(context=ssl_ctx)
)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'hi,en-US;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Origin': 'https://vaad.up.nic.in',
    'Referer': 'https://vaad.up.nic.in/Search_CaseAutoNo.aspx'
}

# Pre-compiled Regexes for maximum speed
RE_VIEWSTATE = re.compile(r'id="__VIEWSTATE"\s+value="([^"]*)"')
RE_EVENTVAL = re.compile(r'id="__EVENTVALIDATION"\s+value="([^"]*)"')
RE_VSGEN = re.compile(r'id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"')
RE_CASEDETAIL = re.compile(r'href="([^"]*case_all_detail\.aspx[^"]+)"', re.IGNORECASE)
RE_PARTY = re.compile(r'id="txt_lbl_party">(.*?)</span>.*?id="txt_lbl_detail">(.*?)</span>', re.DOTALL)
RE_STATUS = re.compile(r'id="lbl_status">(.*?)</span>')
RE_FILING = re.compile(r'id="txt_file_dt">(.*?)</span>')
RE_DISPOSAL = re.compile(r'id="lbl_disposal_dt">(.*?)</span>')
RE_ACT = re.compile(r'id="txt_act_sect_detail">(.*?)</span>')
RE_GENORDERS = re.compile(r'href="([^"]*BOR/Generate_Orders\.aspx[^"]+)"', re.IGNORECASE)
RE_ORDERENTRY = re.compile(r'(\d{2}/\d{2}/\d{4})\b.*?login_type=(\w+).*?order_id=(\d+)', re.DOTALL)
RE_ORDERENTRY_NOLT = re.compile(r'(\d{2}/\d{2}/\d{4})\b.*?order_id=(\d+)', re.DOTALL)
RE_SINGLE_ORDER = re.compile(r'login_type=(\w+)&order_id=(\d+)')
RE_SINGLE_ORDER_NOLT = re.compile(r'order_id=(\d+)')


def safe_encode_url(url_str):
    parsed = urllib.parse.urlsplit(url_str)
    encoded_query = urllib.parse.quote(parsed.query, safe='=&%')
    encoded_path = urllib.parse.quote(parsed.path, safe='/')
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, encoded_path, encoded_query, parsed.fragment))


def format_order_header(html_str):
    header_td_pattern = re.compile(
        r'<td\s+align="center"\s+valign="middle"[^>]*style="[^"]*"[^>]*>(.*?)</td>',
        re.DOTALL | re.IGNORECASE
    )
    match = header_td_pattern.search(html_str)
    if not match:
        header_td_pattern = re.compile(
            r'<td[^>]*>(?=.*?(?:न्यायालय|मण्डल|कम्प्यूटरीकृत वाद संख्या)).*?</td>',
            re.DOTALL | re.IGNORECASE
        )
        match = header_td_pattern.search(html_str)

    if match:
        raw_td_inner = match.group(1)
        
        lines = [re.sub(r'<[^>]+>', '', l).replace('&nbsp;', ' ').strip() for l in raw_td_inner.split('<br />') if l.strip()]
        if len(lines) <= 2:
            lines = [re.sub(r'<[^>]+>', '', l).replace('&nbsp;', ' ').strip() for l in raw_td_inner.split('<br>') if l.strip()]
        
        nyayalaya = ""
        mandal = ""
        comp_no = ""
        case_no = ""
        parties = ""
        act_dhara = ""
        status = ""
        order_date = ""

        for l in lines:
            if 'पीठासीन' in l:
                continue
            elif 'न्यायालय' in l:
                nyayalaya = l
            elif 'मण्डल' in l:
                mandal = l
            elif 'कम्प्यूटरीकृत वाद संख्या' in l or 'कंप्यूटरीकृत वाद संख्या' in l:
                comp_no = l
            elif 'वाद संख्या' in l:
                case_no = l
            elif 'बनाम' in l:
                parties = l
            elif 'धारा' in l or 'अधिनियम' in l or 'संहिता' in l:
                act_dhara = l
            elif 'आदेश तिथि' in l:
                order_date = l
            elif 'आदेश' in l:
                status = l

        # 1. Mandal line formatting
        if mandal:
            m_parts = [p.strip() for p in re.split(r'[,|]', mandal) if p.strip()]
            formatted_m_parts = []
            for p in m_parts:
                p_clean = re.sub(r'^(?:मण्डल|जनपद|तहसील)\s*:\s*-?\s*', '', p)
                if 'मण्डल' in p:
                    formatted_m_parts.append(f"मण्डल:- {p_clean}")
                elif 'जनपद' in p:
                    formatted_m_parts.append(f"जनपद:- {p_clean}")
                elif 'तहसील' in p:
                    formatted_m_parts.append(f"तहसील:- {p_clean}")
                else:
                    formatted_m_parts.append(p)
            mandal_formatted = ",".join(formatted_m_parts)
        else:
            mandal_formatted = ""

        # 2. Nyayalaya line formatting
        nyayalaya_clean = re.sub(r'^न्यायालय\s*:\s*-?\s*', '', nyayalaya).strip()
        nyayalaya_formatted = f"न्यायालय {nyayalaya_clean}" if nyayalaya_clean else ""

        # 3. Case No line formatting
        case_no_clean = re.sub(r'^वाद\s*संख्या\s*:\s*-?\s*', '', case_no).strip()
        case_no_formatted = f"वाद संख्या:- {case_no_clean}" if case_no_clean else ""

        # 4. Parties line formatting
        if 'बनाम' in parties:
            p_parts = parties.split('बनाम')
            vadi = p_parts[0].strip()
            prativadi = p_parts[1].strip()
            parties_formatted = f"{vadi}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;बनाम&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{prativadi}"
        else:
            parties_formatted = parties

        # 5. Computerized Case No line formatting
        comp_no_clean = re.sub(r'^(?:कम्प्यूटरीकृत|कंप्यूटरीकृत)\s*वाद\s*संख्या\s*:\s*-?\s*', '', comp_no).strip()
        comp_no_formatted = f"कंप्यूटरीकृत वाद संख्या :-{comp_no_clean}" if comp_no_clean else ""

        # 6. Act & Section line formatting
        if 'धारा' in act_dhara:
            dhara_m = re.search(r'(?:अंतर्गत|अन्तर्गत)\s*धारा\s*:\s*-?\s*([0-9A-Za-z\s]+)', act_dhara)
            dhara_val = dhara_m.group(1).strip() if dhara_m else ""
            act_val = re.sub(r',?\s*(?:अंतर्गत|अन्तर्गत)\s*धारा\s*:\s*-?\s*[0-9A-Za-z\s]+', '', act_dhara).strip(' ,')
            if dhara_val and act_val:
                act_dhara_formatted = f"अंतर्गत धारा:- {dhara_val},{act_val}"
            elif dhara_val:
                act_dhara_formatted = f"अंतर्गत धारा:- {dhara_val}"
            else:
                act_dhara_formatted = act_dhara
        else:
            act_dhara_formatted = act_dhara

        # 7. Order Date line formatting
        date_clean = re.sub(r'^आदेश\s*तिथि\s*:\s*-?\s*', '', order_date).strip()
        date_formatted = f"आदेश तिथि:- {date_clean}" if date_clean else ""

        # 8. Order Status line formatting
        status_clean = status.replace('"', '').strip()
        status_formatted = status_clean

        new_header_html = f'''<td align="center" valign="middle" style="padding: 10px 0 15px 0;">
            <div style="font-family: 'Hind', 'Mukta', 'Noto Sans Devanagari', 'Mangal', Calibri, sans-serif; text-align: center; color: #000000; font-weight: bold; line-height: 1.5;">
                {f'<div style="font-size: 16px; margin-bottom: 3px;">{mandal_formatted}</div>' if mandal_formatted else ''}
                {f'<div style="font-size: 16px; margin-bottom: 3px;">{nyayalaya_formatted}</div>' if nyayalaya_formatted else ''}
                {f'<div style="font-size: 17px; margin-bottom: 5px;">{case_no_formatted}</div>' if case_no_formatted else ''}
                {f'<div style="font-size: 18px; margin-bottom: 6px; word-spacing: 2px;">{parties_formatted}</div>' if parties_formatted else ''}
                {f'<div style="font-size: 16px; margin-bottom: 3px;">{comp_no_formatted}</div>' if comp_no_formatted else ''}
                {f'<div style="font-size: 16px; margin-bottom: 3px;">{act_dhara_formatted}</div>' if act_dhara_formatted else ''}
                {f'<div style="font-size: 16px; margin-bottom: 3px;">{date_formatted}</div>' if date_formatted else ''}
                {f'<div style="font-size: 17px; margin-top: 3px;">{status_formatted}</div>' if status_formatted else ''}
            </div>
        </td>'''

        html_str = html_str[:match.start()] + new_header_html + html_str[match.end():]

    return html_str


def clean_order_document(html_str, remove_qr=True, remove_disclaimer=True):
    cleaned = html_str.replace('src="BarCode_Print.aspx', 'src="https://vaad.up.nic.in/judgement/BarCode_Print.aspx')
    cleaned = cleaned.replace('src="../QRCodeJs/', 'src="https://vaad.up.nic.in/QRCodeJs/')

    # Remove "पीठासीन अधिकारी का नाम" row and line completely without leaving empty gaps
    cleaned = re.sub(r'<tr>\s*<td[^>]*>\s*(?:<b>|<strong>)?\s*पीठासीन अधिकारी का नाम.*?(?:</b>|</strong>)?\s*</td>\s*</tr>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'(?:<b>|<strong>)?\s*पीठासीन अधिकारी का नाम\s*:\s*-?\s*[^<\n\r]*(?:</b>|</strong>)?\s*(?:<br\s*/?>)?\s*', '', cleaned, flags=re.IGNORECASE)

    # Format header to exact user image layout
    cleaned = format_order_header(cleaned)

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
        @import url('https://fonts.googleapis.com/css2?family=Hind:wght@500;600;700&family=Mukta:wght@500;600;700&display=swap');
        body, td, div, p {
            font-family: 'Hind', 'Mukta', 'Noto Sans Devanagari', 'Mangal', Calibri, sans-serif !important;
        }
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
    now = time.time()
    if case_auto_no in CASE_CACHE:
        cached_time, cached_data = CASE_CACHE[case_auto_no]
        if now - cached_time < CACHE_TTL:
            return cached_data

    get_req = urllib.request.Request('https://vaad.up.nic.in/Search_CaseAutoNo.aspx', headers=HEADERS)
    html_get = opener.open(get_req, timeout=5).read().decode('utf-8', errors='ignore')

    vs_m = RE_VIEWSTATE.search(html_get)
    ev_m = RE_EVENTVAL.search(html_get)
    vsg_m = RE_VSGEN.search(html_get)

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
    html_post = opener.open(post_req, timeout=5).read().decode('utf-8', errors='ignore')

    casedetail_links = RE_CASEDETAIL.findall(html_post)
    if not casedetail_links:
        return None

    raw_link = casedetail_links[0].replace('./', '').replace('&amp;', '&')
    detail_raw_url = "https://vaad.up.nic.in/" + raw_link
    detail_url = safe_encode_url(detail_raw_url)

    detail_html = opener.open(urllib.request.Request(detail_url, headers=HEADERS), timeout=5).read().decode('utf-8', errors='ignore')

    case_no_m = re.search(r'cno=([^&]+)', detail_url)
    cyear_m = re.search(r'cyear=([^&]+)', detail_url)
    case_no = f"{case_no_m.group(1)}/{cyear_m.group(1)}" if (case_no_m and cyear_m) else "वाद दर्ज"

    party_match = RE_PARTY.search(detail_html)
    vadi = party_match.group(1).replace('&nbsp;', ' ').strip() if party_match else ""
    prativadi = party_match.group(2).replace('&nbsp;', ' ').strip() if party_match else ""
    parties = f"{vadi} बनाम {prativadi}" if (vadi or prativadi) else "वादी बनाम प्रतिवादी"

    status_m = RE_STATUS.search(detail_html)
    filing_m = RE_FILING.search(detail_html)
    disposal_m = RE_DISPOSAL.search(detail_html)
    act_m = RE_ACT.search(detail_html)

    status = status_m.group(1).strip() if status_m else "निस्तारित"
    filing_dt = filing_m.group(1).strip() if filing_m else ""
    disposal_dt = disposal_m.group(1).strip() if disposal_m else ""
    act_sect = act_m.group(1).strip() if act_m else "उत्तर प्रदेश राजस्व संहिता - 2006"

    orders_list = []
    gen_orders_link = RE_GENORDERS.search(detail_html)
    
    if gen_orders_link:
        gen_raw_link = gen_orders_link.group(1).replace('./', '').replace('&amp;', '&')
        gen_raw_url = "https://vaad.up.nic.in/" + gen_raw_link
        gen_url = safe_encode_url(gen_raw_url)
        try:
            gen_html = opener.open(urllib.request.Request(gen_url, headers=HEADERS), timeout=4).read().decode('utf-8', errors='ignore')
            # Try regex with login_type first
            order_entries = RE_ORDERENTRY.findall(gen_html)
            if order_entries:
                for idx, (date_str, lt, oid) in enumerate(order_entries):
                    is_latest = (idx == len(order_entries) - 1)
                    orders_list.append({
                        "order_no": idx + 1,
                        "order_date": date_str,
                        "order_id": oid,
                        "login_type": lt,
                        "is_latest": is_latest,
                        "title": f"आदेश {idx + 1} (तिथि: {date_str})" + (" - अंतिम आदेश" if is_latest else "")
                    })
            else:
                # Fallback: extract without login_type
                order_entries_nolt = RE_ORDERENTRY_NOLT.findall(gen_html)
                # Try to get ltype from gen_url
                ltype_m = re.search(r'ltype=([^&]+)', gen_url)
                default_lt = ltype_m.group(1) if ltype_m else "T"
                for idx, (date_str, oid) in enumerate(order_entries_nolt):
                    is_latest = (idx == len(order_entries_nolt) - 1)
                    orders_list.append({
                        "order_no": idx + 1,
                        "order_date": date_str,
                        "order_id": oid,
                        "login_type": default_lt,
                        "is_latest": is_latest,
                        "title": f"आदेश {idx + 1} (तिथि: {date_str})" + (" - अंतिम आदेश" if is_latest else "")
                    })
        except Exception as e:
            print("Generate orders error:", e)

    if not orders_list:
        all_oids = RE_SINGLE_ORDER.findall(detail_html)
        if all_oids:
            for idx, (lt, oid) in enumerate(all_oids):
                is_latest = (idx == len(all_oids) - 1)
                orders_list.append({
                    "order_no": idx + 1,
                    "order_date": disposal_dt or "अंतिम आदेश",
                    "order_id": oid,
                    "login_type": lt,
                    "is_latest": is_latest,
                    "title": f"आदेश {idx + 1} (तिथि: {disposal_dt or 'अंतिम आदेश'})" + (" - अंतिम आदेश" if is_latest else "")
                })
        else:
            all_oids_nolt = RE_SINGLE_ORDER_NOLT.findall(detail_html)
            ltype_m = re.search(r'ltype=([^&]+)', detail_url)
            default_lt = ltype_m.group(1) if ltype_m else "T"
            for idx, oid in enumerate(all_oids_nolt):
                is_latest = (idx == len(all_oids_nolt) - 1)
                orders_list.append({
                    "order_no": idx + 1,
                    "order_date": disposal_dt or "अंतिम आदेश",
                    "order_id": oid,
                    "login_type": default_lt,
                    "is_latest": is_latest,
                    "title": f"आदेश {idx + 1} (तिथि: {disposal_dt or 'अंतिम आदेश'})" + (" - अंतिम आदेश" if is_latest else "")
                })

    result_data = {
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

    # Store in high speed cache
    CASE_CACHE[case_auto_no] = (now, result_data)
    return result_data


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path.startswith("/api/status"):
            self.send_json_response({"status": "online", "server": "UP VAAD High-Speed Engine Active"})
            return

        if path.startswith("/api/search"):
            case_no = query.get("case_no", [""])[0].strip().upper()
            if not case_no:
                self.send_json_response({"error": "कृपया कंप्यूटरीकृत वाद संख्या दर्ज करें"}, status=400)
                return

            try:
                live_data = live_search_vaad_case(case_no)
                if live_data:
                    self.send_json_response({"success": True, "source": "live_nic_server", "data": live_data})
                    return
                else:
                    self.send_json_response({
                        "success": False,
                        "error": f"कंप्यूटरीकृत वाद संख्या '{case_no}' vaad.up.nic.in सर्वर पर उपलब्ध नहीं है।"
                    }, status=404)
                    return
            except Exception as ex:
                self.send_json_response({"success": False, "error": f"Live error: {str(ex)}"}, status=500)
                return

        if path.startswith("/api/fetch-order"):
            order_id = query.get("order_id", [""])[0]
            login_type = query.get("login_type", [""])[0] or ""
            remove_qr = query.get("remove_qr", ["true"])[0].lower() == "true"
            remove_disclaimer = query.get("remove_disclaimer", ["true"])[0].lower() == "true"

            cache_key = f"{order_id}_{login_type}_{remove_qr}_{remove_disclaimer}"
            now = time.time()
            if cache_key in ORDER_CACHE:
                cached_time, cached_html = ORDER_CACHE[cache_key]
                if now - cached_time < ORDER_TTL:
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(cached_html.encode("utf-8"))
                    return

            raw_html = ""
            # Try login_types: use provided one first, then try the other as fallback
            types_to_try = [login_type] if login_type else ["T", "NT"]
            if login_type == "T":
                types_to_try = ["T", "NT"]
            elif login_type == "NT":
                types_to_try = ["NT", "T"]

            for lt in types_to_try:
                try:
                    target_url = f"https://vaad.up.nic.in/judgement/Print_Court_Order_External.aspx?login_type={lt}&order_id={order_id}"
                    req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                    with urllib.request.urlopen(req, context=ssl_ctx, timeout=6) as resp:
                        raw_html = resp.read().decode('utf-8', errors='ignore')
                    # Check if it's the upload error page
                    if 'अपलोड नहीं किया गया' not in raw_html and 'अपलोड करें' not in raw_html:
                        break  # Found the correct login_type!
                except Exception as ex:
                    raw_html = f"<h2>आदेश प्राप्त करने में समस्या: {str(ex)}</h2>"

            final_html = clean_order_document(raw_html, remove_qr=remove_qr, remove_disclaimer=remove_disclaimer)
            ORDER_CACHE[cache_key] = (now, final_html)

            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(final_html.encode("utf-8"))
            return

        self.send_json_response({"error": "Endpoint not found"}, status=404)

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
