import os
import re
import ssl
import time
import json
import urllib.request
import urllib.parse
import http.cookiejar
from http.server import BaseHTTPRequestHandler

# Setup SSL & Cookie Processor
cookie_jar = http.cookiejar.CookieJar()
ssl_ctx = ssl._create_unverified_context()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar),
    urllib.request.HTTPSHandler(context=ssl_ctx)
)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'hi,en-US;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Origin': 'https://vaad.up.nic.in',
    'Referer': 'https://vaad.up.nic.in/Search_CaseAutoNo.aspx'
}

# Regular expressions
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

# Memory Caches
CASE_CACHE = {}
ORDER_CACHE = {}
CACHE_TTL = 1800
ORDER_TTL = 3600


def safe_encode_url(url_str):
    url_str = url_str.replace('&amp;', '&')
    parsed = urllib.parse.urlsplit(url_str)
    encoded_query = urllib.parse.quote(parsed.query, safe='=&%')
    encoded_path = urllib.parse.quote(parsed.path, safe='/')
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, encoded_path, encoded_query, parsed.fragment))


def fetch_with_retry(opener, req, timeout=8, retries=2):
    for attempt in range(retries):
        try:
            resp = opener.open(req, timeout=timeout)
            return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(0.5)


def reformat_order_header_html(html_str):
    cleaned = html_str
    
    # 1. Remove पीठासीन अधिकारी का नाम line and its line breaks cleanly
    cleaned = re.sub(r'<br\s*/?>\s*पीठासीन अधिकारी का नाम:[^<]*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'पीठासीन अधिकारी का नाम:[^<]*<br\s*/?>\s*', '', cleaned, flags=re.IGNORECASE)

    # 2. Format Act & Section so 'अंतर्गत धारा' comes FIRST, followed by 'उत्तर प्रदेश राजस्व संहिता'
    def swap_act_section(m):
        act_part = m.group(1).strip()
        sec_part = m.group(2).strip()
        return f"{sec_part} , {act_part}"

    cleaned = re.sub(r'(उत्तर प्रदेश राजस्व संहिता\s*-[^,<\n]+)\s*,\s*(अंतर्गत धारा:[^<\n]+)', swap_act_section, cleaned, flags=re.IGNORECASE)

    # 3. Target the header <td align="center"...> and re-arrange top lines:
    # 1. मण्डल (Mandal, Janpad, Tehsil)
    # 2. न्यायालय (Court)
    # 3. वाद संख्या (Case No)
    # 4. [Names] (वादी बनाम प्रतिवादी)
    # 5. कंप्यूटरीकृत वाद संख्या (Computerized Case No)
    # 6. अंतर्गत धारा (Act/Section)
    # 7. आदेश तिथि (Order Date)
    # 8. अंतिम आदेश (Order Type without quotes)
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
        if mandal_line:
            new_lines.append(mandal_line)
        if court_line:
            new_lines.append(court_line)
        if case_no_line:
            new_lines.append(case_no_line)
        if parties_line:
            new_lines.append(parties_line)
        if comp_no_line:
            new_lines.append(comp_no_line)
        if act_sec_line:
            new_lines.append(act_sec_line)
        if order_date_line:
            new_lines.append(order_date_line)
        if order_type_line:
            new_lines.append(order_type_line)
        
        new_lines.extend(other_lines)
        new_inner = "<br />".join(new_lines)
        return f'<td{attrs}>{new_inner}</td>'

    pattern = r'<td([^>]*valign="middle"[^>]*)>(.*?"?न्यायालय.*?)</td>'
    cleaned = re.sub(pattern, replace_header_td, cleaned, flags=re.DOTALL | re.IGNORECASE)

    return cleaned


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


def live_search_vaad_case(case_auto_no):
    case_auto_no = case_auto_no.strip().upper()
    now = time.time()
    if case_auto_no in CASE_CACHE:
        cached_time, cached_data = CASE_CACHE[case_auto_no]
        if now - cached_time < CACHE_TTL:
            return cached_data

    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookie_jar),
        urllib.request.HTTPSHandler(context=ssl_ctx)
    )

    get_req = urllib.request.Request('https://vaad.up.nic.in/Search_CaseAutoNo.aspx', headers=HEADERS)
    html_get = fetch_with_retry(opener, get_req, timeout=8, retries=2)

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
    html_post = fetch_with_retry(opener, post_req, timeout=8, retries=2)

    casedetail_links = RE_CASEDETAIL.findall(html_post)
    if not casedetail_links:
        return None

    raw_link = casedetail_links[0].replace('./', '').replace('&amp;', '&')
    detail_raw_url = "https://vaad.up.nic.in/" + raw_link
    detail_url = safe_encode_url(detail_raw_url)

    detail_html = fetch_with_retry(opener, urllib.request.Request(detail_url, headers=HEADERS), timeout=8, retries=2)

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
            gen_html = fetch_with_retry(opener, urllib.request.Request(gen_url, headers=HEADERS), timeout=7, retries=2)
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
                order_entries_nolt = RE_ORDERENTRY_NOLT.findall(gen_html)
                ltype_m = re.search(r'ltype=([^&]+)', gen_url)
                default_lt = ltype_m.group(1) if ltype_m else "NT"
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
            print("Generate orders warning:", e)

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
            default_lt = ltype_m.group(1) if ltype_m else "NT"
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
                self.send_json_response({"success": False, "error": "कृपया कंप्यूटरीकृत वाद संख्या दर्ज करें"}, status=400)
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
                    }, status=200)
                    return
            except Exception as ex:
                print("Live search exception:", ex)
                self.send_json_response({
                    "success": False,
                    "error": "vaad.up.nic.in सर्वर अत्यधिक व्यस्त है। कृपया 2 सेकंड बाद पुनः 'प्रदर्शित करें' दबाएं।"
                }, status=200)
                return

        if path.startswith("/api/fetch-order"):
            order_id = query.get("order_id", ["26930019"])[0]
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
            types_to_try = [login_type] if login_type else ["T", "NT"]
            if login_type == "T":
                types_to_try = ["T", "NT"]
            elif login_type == "NT":
                types_to_try = ["NT", "T"]

            from concurrent.futures import ThreadPoolExecutor

            def _fetch_order_worker(lt):
                target_url = f"https://vaad.up.nic.in/judgement/Print_Court_Order_External.aspx?login_type={lt}&order_id={order_id}"
                req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
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
                raw_html = "<h2>आदेश उपलब्ध नहीं है अथवा लोड नहीं हो सका।</h2>"

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
