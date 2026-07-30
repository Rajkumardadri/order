# UP Revenue Court Clean Order Printer - Version 2 (v2)

यह **v2** वर्ज़न आपकी मूल वेबसाइट की सभी फ़ाइलों को सुरक्षित रखते हुए एक नए पृथक (standalone) फ़ोल्डर में तैयार किया गया है।

---

## 🌐 इस वेबसाइट को ऑनलाइन URL पर चलाने के दो आसान तरीके (How to host on a public URL)

### तरीका 1: 24/7 नि:शुल्क क्लाउड होस्टिंग (Render / Koyeb) - **सर्वोत्तम एवं स्थायी**
यदि आप चाहते हैं कि आपका कंप्यूटर बंद भी हो, तब भी आपकी वेबसाइट दुनिया में कहीं से भी (मोबाइल, लैपटॉप, टैबलेट) खुलती रहे:

1. **GitHub पर कोड अपलोड करें**:
   - `v2/` फ़ोल्डर के कोड को GitHub Repository में पुश (Push) करें।
2. **Render.com पर मुफ़्त अकाउंट बनाएं**:
   - [render.com](https://render.com) पर जाएँ और **New > Web Service** चुनें।
   - अपनी GitHub Repository लिंक करें।
   - Build Command: (खाली छोड़ें या `pip install -r requirements.txt`)
   - Start Command: `python server.py`
3. **मुफ़्त URL प्राप्त करें**:
   - Render आपको 2 मिनट में एक स्थायी HTTPS URL देगा (जैसे: `https://up-vaad-order.onrender.com`), जिसे आप कहीं भी इस्तेमाल कर सकते हैं।

---

### तरीका 2: तुरंत 1 मिनट में फ्री पब्लिक URL (Cloudflare / LocalTunnel)
यदि आपका सर्वर आपके कंप्यूटर पर चल रहा है और आप इसे तुरंत किसी मोबाइल या अन्य डिवाइस पर शेयर करना चाहते हैं:

1. `v2/start_server.bat` चलाकर सर्वर शुरू करें (Port 8081)।
2. CMD / Terminal में यह कमांड चलाएँ:
   ```bash
   npx localtunnel --port 8081
   ```
   या (Cloudflare Tunnel):
   ```bash
   npx cloudflared tunnel --url http://localhost:8081
   ```
3. आपको तुरंत एक लाइव पब्लिक URL मिल जाएगा (उदा. `https://my-court-order.loca.lt`), जिसे आप अपने फोन या किसी को भी भेजकर इस्तेमाल कर सकते हैं।

---

## 🚀 लोकल कंप्यूटर पर चलाने का तरीका

1. `v2` डायरेक्टरी खोलें।
2. `start_server.bat` फ़ाइल पर डबल-क्लिक करें।
3. ब्राउज़र में `http://localhost:8081` खोलें।
