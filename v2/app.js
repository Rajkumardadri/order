document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const searchForm = document.getElementById('searchForm');
    const caseAutoNoInput = document.getElementById('caseAutoNo');
    const loadSampleBtn = document.getElementById('loadSampleBtn');
    const removeQrToggle = document.getElementById('removeQrToggle');
    const removeDisclaimerToggle = document.getElementById('removeDisclaimerToggle');
    const loader = document.getElementById('loader');
    
    const caseSummarySection = document.getElementById('caseSummarySection');
    const valCaseNo = document.getElementById('valCaseNo');
    const valComputerNo = document.getElementById('valComputerNo');
    const valLocation = document.getElementById('valLocation');
    const valCourt = document.getElementById('valCourt');
    const valParties = document.getElementById('valParties');
    const valFilingDate = document.getElementById('valFilingDate');
    const valDisposalDate = document.getElementById('valDisposalDate');
    const valActSection = document.getElementById('valActSection');
    const ordersListTabs = document.getElementById('ordersListTabs');
    
    const activeOrderBadge = document.getElementById('activeOrderBadge');
    const barcodeStatusText = document.getElementById('barcodeStatusText');
    const orderIframe = document.getElementById('orderIframe');
    
    const printLatestDirectBtn = document.getElementById('printLatestDirectBtn');
    const printCleanOrderBtn = document.getElementById('printCleanOrderBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');

    // App State
    let currentCaseData = null;
    let currentOrderId = null;
    let removeSquareBarcode = true;
    let removeDisclaimer = true;

    // Check Server Status
    fetchServerStatus();

    // Event Listeners
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const caseNo = caseAutoNoInput.value.trim();
        if (caseNo) {
            performSearch(caseNo);
        }
    });

    if (loadSampleBtn) {
        loadSampleBtn.addEventListener('click', () => {
            caseAutoNoInput.value = 'T202411270212200';
            performSearch('T202411270212200');
        });
    }

    removeQrToggle.addEventListener('change', (e) => {
        removeSquareBarcode = e.target.checked;
        updateStatusText();
        if (currentOrderId) {
            const activeOrder = currentCaseData && currentCaseData.orders ? currentCaseData.orders.find(o => o.order_id === currentOrderId) : null;
            const lt = activeOrder ? (activeOrder.login_type || 'T') : 'T';
            fetchAndRenderOrder(currentOrderId, lt);
        }
    });

    removeDisclaimerToggle.addEventListener('change', (e) => {
        removeDisclaimer = e.target.checked;
        updateStatusText();
        if (currentOrderId) {
            const activeOrder = currentCaseData && currentCaseData.orders ? currentCaseData.orders.find(o => o.order_id === currentOrderId) : null;
            const lt = activeOrder ? (activeOrder.login_type || 'T') : 'T';
            fetchAndRenderOrder(currentOrderId, lt);
        }
    });

    printCleanOrderBtn.addEventListener('click', () => {
        triggerIframePrint();
    });

    printLatestDirectBtn.addEventListener('click', () => {
        if (currentCaseData && currentCaseData.orders && currentCaseData.orders.length > 0) {
            const latest = currentCaseData.orders.find(o => o.is_latest) || currentCaseData.orders[currentCaseData.orders.length - 1];
            selectOrder(latest.order_id);
            setTimeout(() => {
                triggerIframePrint();
            }, 400);
        }
    });

    downloadPdfBtn.addEventListener('click', () => {
        downloadCleanPdf();
    });

// Auto load default case on startup (removed per user request)

    // Functions
    async function fetchServerStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            if (data.status === 'online') {
                const statusBadge = document.getElementById('serverStatus');
                statusBadge.innerHTML = `<span class="status-dot online"></span><span class="status-text">वैध सर्वर (Live UP VAAD Connected)</span>`;
            }
        } catch (e) {
            console.warn('Server offline mode');
        }
    }

    async function performSearch(caseNo) {
        showLoader(true);
        caseSummarySection.classList.add('hidden');

        try {
            const response = await fetch(`/api/search?case_no=${encodeURIComponent(caseNo)}`);
            const result = await response.json();

            if (result.success && result.data) {
                currentCaseData = result.data;
                renderCaseDetails(currentCaseData);
                showLoader(false);
                caseSummarySection.classList.remove('hidden');

                if (currentCaseData.orders && currentCaseData.orders.length > 0) {
                    const latest = currentCaseData.orders.find(o => o.is_latest) || currentCaseData.orders[currentCaseData.orders.length - 1];
                    selectOrder(latest.order_id);
                }
            } else {
                alert(result.error || 'मामला नहीं मिला। कृपया कंप्यूटरीकृत वाद संख्या की जाँच करें।');
                showLoader(false);
            }
        } catch (err) {
            console.error('Search error:', err);
            showLoader(false);
            alert('सर्वर से संपर्क करने में त्रुटि हुई।');
        }
    }

    function renderCaseDetails(data) {
        valCaseNo.textContent = data.case_no || '12200/2024';
        valComputerNo.textContent = data.computer_case_no || '';
        valLocation.textContent = `${data.mandal || 'मेरठ'} - ${data.janpad || 'गौतम बुद्ध नगर'} - ${data.tehsil || 'दादरी'}`;
        valCourt.textContent = data.nyayalaya || 'तहसीलदार';
        valParties.textContent = data.vadi_prativadi || '';
        valFilingDate.textContent = data.filing_date || '';
        valDisposalDate.textContent = data.disposal_date || '';
        valActSection.textContent = data.act_section || '';

        // Render Order Tabs for ALL available orders
        ordersListTabs.innerHTML = '';
        if (data.orders && data.orders.length > 0) {
            data.orders.forEach(order => {
                const tabBtn = document.createElement('button');
                tabBtn.className = `order-tab-btn ${order.is_latest ? 'latest' : ''}`;
                tabBtn.dataset.orderId = order.order_id;
                tabBtn.innerHTML = `
                    <span>📄 ${order.title}</span>
                    ${order.is_latest ? '<span class="latest-pill">अंतिम आदेश</span>' : ''}
                `;
                tabBtn.addEventListener('click', () => selectOrder(order.order_id));
                ordersListTabs.appendChild(tabBtn);
            });
        } else {
            ordersListTabs.innerHTML = `<div style="padding: 10px; color: #888;">इस वाद के लिए कोई आदेश फाइल उपलब्ध नहीं है।</div>`;
        }
    }

    async function selectOrder(orderId) {
        currentOrderId = orderId;
        
        document.querySelectorAll('.order-tab-btn').forEach(btn => {
            if (btn.dataset.orderId === orderId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const activeOrderObj = currentCaseData.orders.find(o => o.order_id === orderId);
        if (activeOrderObj) {
            activeOrderBadge.textContent = activeOrderObj.title;
        }

        const loginType = activeOrderObj ? (activeOrderObj.login_type || 'T') : 'T';
        await fetchAndRenderOrder(orderId, loginType);
    }

    async function fetchAndRenderOrder(orderId, loginType) {
        try {
            const lt = loginType || 'T';
            const url = `/api/fetch-order?order_id=${orderId}&login_type=${lt}&remove_qr=${removeSquareBarcode}&remove_disclaimer=${removeDisclaimer}`;
            orderIframe.src = url;
            updateStatusText();
        } catch (err) {
            console.error('Error rendering order:', err);
        }
    }

    function updateStatusText() {
        let msg = [];
        if (removeSquareBarcode) msg.push('स्क्वायर बारकोड हटा');
        if (removeDisclaimer) msg.push('Disclaimer हटा');

        if (msg.length > 0) {
            barcodeStatusText.innerHTML = `✅ ${msg.join(' और ')} हुआ स्वच्छ आदेश तैयार है`;
            barcodeStatusText.style.color = '#2ecc71';
        } else {
            barcodeStatusText.innerHTML = `⚠️ ऑरिजनल NIC व्यू (विद बारकोड एवं Disclaimer)`;
            barcodeStatusText.style.color = '#f39c12';
        }
    }

    function triggerIframePrint() {
        if (orderIframe && orderIframe.contentWindow) {
            orderIframe.contentWindow.focus();
            orderIframe.contentWindow.print();
        }
    }

    function downloadCleanPdf() {
        if (orderIframe && orderIframe.contentDocument) {
            const docBody = orderIframe.contentDocument.body;
            const opt = {
                margin:       [10, 10, 10, 10],
                filename:     `UP_VAAD_Order_${currentCaseData ? currentCaseData.computer_case_no : 'Case'}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            if (typeof html2pdf !== 'undefined') {
                html2pdf().set(opt).from(docBody).save();
            } else {
                triggerIframePrint();
            }
        } else {
            triggerIframePrint();
        }
    }

    function showLoader(show) {
        if (show) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }
    }
});
