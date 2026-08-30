import re
import ssl
import time
import json
import urllib.request
import urllib.parse
import http.cookiejar
from http.server import BaseHTTPRequestHandler
from concurrent.futures import ThreadPoolExecutor

ssl_ctx = ssl._create_unverified_context()

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'hi,en-US;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Origin': 'https://vaad.up.nic.in',
    'Referer': 'https://vaad.up.nic.in/Search_CaseAutoNo.aspx'
}

RE_VIEWSTATE = re.compile(r'id="__VIEWSTATE"\s+value="([^"]*)"')
RE_EVENTVAL = re.compile(r'id="__EVENTVALIDATION"\s+value="([^"]*)"')
RE_VSGEN = re.compile(r'id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"')
RE_CASEDETAIL = re.compile(r'href="([^"]*case_all_detail\.aspx[^"]+)"', re.IGNORECASE)
RE_PARTY = re.compile(r'id="txt_lbl_party">(.*?)</span>.*?id="txt_lbl_detail">(.*?)</span>', re.DOTALL)
RE_STATUS = re.compile(r'id="lbl_status">(.*?)</span>')
RE_FILING = re.compile(r'id="txt_file_dt">(.*?)</span>')
RE_DISPOSAL = re.compile(r'id="lbl_disposal_dt">(.*?)</span>')
RE_ACT = re.compile(r'id="txt_act_sect_detail">(.*?)</span>')
RE_ORDERENTRY = re.compile(r'(\d{2}/\d{2}/\d{4})\b.*?login_type=(\w+).*?order_id=(\d+)', re.DOTALL)
RE_ORDERENTRY_NOLT = re.compile(r'(\d{2}/\d{2}/\d{4})\b.*?order_id=(\d+)', re.DOTALL)
RE_SINGLE_ORDER = re.compile(r'login_type=(\w+)&order_id=(\d+)')
RE_SINGLE_ORDER_NOLT = re.compile(r'order_id=(\d+)')

def safe_encode_url(url_str):
    url_str = url_str.replace('&amp;', '&')
    parsed = urllib.parse.urlsplit(url_str)
    encoded_query = urllib.parse.quote(parsed.query, safe='=&%')
    encoded_path = urllib.parse.quote(parsed.path, safe='/')
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, encoded_path, encoded_query, parsed.fragment))

def fetch_with_retry(opener, req, timeout=4, retries=2):
    for attempt in range(retries):
        try:
            resp = opener.open(req, timeout=timeout)
            return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(0.5)

def live_search_vaad_case(case_auto_no):
    case_auto_no = case_auto_no.strip().upper()
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookie_jar),
        urllib.request.HTTPSHandler(context=ssl_ctx)
    )

    get_req = urllib.request.Request('https://vaad.up.nic.in/Search_CaseAutoNo.aspx', headers=HEADERS)
    html_get = fetch_with_retry(opener, get_req, timeout=4, retries=2)

    vs = RE_VIEWSTATE.search(html_get).group(1)
    ev = RE_EVENTVAL.search(html_get).group(1)
    vsg_m = RE_VSGEN.search(html_get)
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
    html_post = fetch_with_retry(opener, post_req, timeout=4, retries=2)

    casedetail_links = RE_CASEDETAIL.findall(html_post)
    if not casedetail_links:
        return None

    raw_link = casedetail_links[0].replace('./', '').replace('&amp;', '&')
    detail_raw_url = "https://vaad.up.nic.in/" + raw_link
    detail_url = safe_encode_url(detail_raw_url)

    cno_m = re.search(r'cno=([^&]+)', detail_raw_url)
    cyear_m = re.search(r'cyear=([^&]+)', detail_raw_url)
    act_cd_m = re.search(r'act_cd=([^&]+)', detail_raw_url)
    section_cd_m = re.search(r'section_cd=([^&]+)', detail_raw_url)
    login_cd_m = re.search(r'login_cd=([^&]+)', detail_raw_url)

    cno = cno_m.group(1) if cno_m else ""
    cyear = cyear_m.group(1) if cyear_m else ""
    act_cd = act_cd_m.group(1) if act_cd_m else ""
    section_cd = section_cd_m.group(1) if section_cd_m else ""
    login_cd = login_cd_m.group(1) if login_cd_m else ""
    ltype = "T" if login_cd.startswith("T") else "NT"

    gen_raw_url = f"https://vaad.up.nic.in/BOR/Generate_Orders.aspx?act_cd={act_cd}&section_cd={section_cd}&cno={cno}&lcd={login_cd}&cyear={cyear}&ltype={ltype}&compu_case_no={case_auto_no}&petname=&resname=&cd=1"
    gen_url = safe_encode_url(gen_raw_url)

    def _fetch_url(u):
        try:
            return opener.open(urllib.request.Request(u, headers=HEADERS), timeout=4).read().decode('utf-8', errors='ignore')
        except Exception:
            return ""

    with ThreadPoolExecutor(max_workers=2) as executor:
        f_detail = executor.submit(_fetch_url, detail_url)
        f_gen = executor.submit(_fetch_url, gen_url)
        detail_html = f_detail.result()
        gen_html = f_gen.result()

    case_no = f"{cno}/{cyear}" if (cno and cyear) else "वाद दर्ज"

    party_match = RE_PARTY.search(detail_html) if detail_html else None
    vadi = party_match.group(1).replace('&nbsp;', ' ').strip() if party_match else ""
    prativadi = party_match.group(2).replace('&nbsp;', ' ').strip() if party_match else ""
    parties = f"{vadi} बनाम {prativadi}" if (vadi or prativadi) else "वादी बनाम प्रतिवादी"

    status_m = RE_STATUS.search(detail_html) if detail_html else None
    filing_m = RE_FILING.search(detail_html) if detail_html else None
    disposal_m = RE_DISPOSAL.search(detail_html) if detail_html else None
    act_m = RE_ACT.search(detail_html) if detail_html else None

    status = status_m.group(1).strip() if status_m else "निस्तारित"
    filing_dt = filing_m.group(1).strip() if filing_m else ""
    disposal_dt = disposal_m.group(1).strip() if disposal_m else ""
    act_sect = act_m.group(1).strip() if act_m else "उत्तर प्रदेश राजस्व संहिता - 2006"

    orders_list = []
    if gen_html:
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
            for idx, (date_str, oid) in enumerate(order_entries_nolt):
                is_latest = (idx == len(order_entries_nolt) - 1)
                orders_list.append({
                    "order_no": idx + 1,
                    "order_date": date_str,
                    "order_id": oid,
                    "login_type": ltype,
                    "is_latest": is_latest,
                    "title": f"आदेश {idx + 1} (तिथि: {date_str})" + (" - अंतिम आदेश" if is_latest else "")
                })

    if not orders_list and detail_html:
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
            for idx, oid in enumerate(all_oids_nolt):
                is_latest = (idx == len(all_oids_nolt) - 1)
                orders_list.append({
                    "order_no": idx + 1,
                    "order_date": disposal_dt or "अंतिम आदेश",
                    "order_id": oid,
                    "login_type": ltype,
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
    return result_data

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        case_no = query.get("case_no", [""])[0].strip().upper()

        if not case_no:
            self.send_json({"success": False, "error": "कृपया कंप्यूटरीकृत वाद संख्या दर्ज करें"}, 400)
            return

        try:
            live_data = live_search_vaad_case(case_no)
            if live_data:
                self.send_json({"success": True, "source": "live_nic_server", "data": live_data}, 200)
            else:
                self.send_json({"success": False, "error": f"कंप्यूटरीकृत वाद संख्या '{case_no}' vaad.up.nic.in सर्वर पर उपलब्ध नहीं है।"}, 200)
        except Exception as ex:
            self.send_json({"success": False, "error": "सरकारी सर्वर (vaad.up.nic.in) व्यस्त है। कृपया 2 सेकंड बाद पुनः प्रयास करें।"}, 200)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
