const API_URL = '/api';
let html5QrCode;
let adminToken = null; // Aquí guardaremos el token automáticamente

// =============================================
// Manejo de Sesión Admin
// =============================================
async function loginAdmin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    const msgDiv = document.getElementById('adminLoginMsg');

    if (!user || !pass) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ Ingresa usuario y contraseña.';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await response.json();

        if (response.ok) {
            adminToken = data.token; // Guardamos el token en memoria
            document.getElementById('adminLoginForm').style.display = 'none';
            document.getElementById('adminLoggedIn').style.display = 'block';
        } else {
            throw new Error(data.error || 'Credenciales inválidas');
        }
    } catch (error) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ ' + error.message;
    }
}

function logoutAdmin() {
    adminToken = null;
    document.getElementById('adminLoginForm').style.display = 'block';
    document.getElementById('adminLoggedIn').style.display = 'none';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    document.getElementById('adminLoginMsg').innerText = '';
}

// =============================================
// Navegación entre Pestañas
// =============================================
function switchTab(tabName, event) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    if (tabName !== 'validate' && html5QrCode && html5QrCode.isScanning) stopScanner();
}

// =============================================
// Generar por Lote
// =============================================
async function generateBatch() {
    const btn = document.getElementById('btnGenerate');
    const msgDiv = document.getElementById('genMessage');
    
    if (!adminToken) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ Debes iniciar sesión como admin primero.';
        return;
    }

    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const desde = document.getElementById('desdeGen').value;
    const hasta = document.getElementById('hastaGen').value;

    if (!desde || !hasta) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ Completa el rango.';
        return;
    }

    btn.disabled = true;
    btn.innerText = 'Generando...';
    msgDiv.className = 'message warning';
    msgDiv.innerText = '⏳ Generando boletas, esto puede tardar unos segundos...';

    try {
        const response = await fetch(`${API_URL}/tickets/generate-batch`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ desde, hasta, tipo })
        });
        const data = await response.json();

        if (response.ok) {
            msgDiv.className = 'message success';
            msgDiv.innerText = `✅ ${data.total} boletas generadas con éxito.`;
        } else {
            throw new Error(data.error || 'Error al generar');
        }
    } catch (error) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ ' + error.message;
    } finally {
        btn.disabled = false;
        btn.innerText = 'Generar Boletas';
    }
}

// =============================================
// Ver Boletas (Lista)
// =============================================
async function fetchTickets() {
    const msgDiv = document.getElementById('listMessage');
    const tableContainer = document.getElementById('ticketsTableContainer');

    if (!adminToken) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ Debes iniciar sesión como admin primero.';
        return;
    }

    msgDiv.className = 'message warning';
    msgDiv.innerText = '⏳ Cargando...';

    try {
        const response = await fetch(`${API_URL}/tickets/all`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();

        if (response.ok) {
            const tbody = document.getElementById('ticketsBody');
            tbody.innerHTML = ''; // Limpiar tabla

            data.tickets.forEach(t => {
                const tr = document.createElement('tr');
                const estadoClass = t.usado ? 'state-used' : 'state-available';
                const estadoText = t.usado ? 'Usado' : 'Disponible';
                
                tr.innerHTML = `
                    <td>${t.serial}</td>
                    <td>${t.tipo}</td>
                    <td class="${estadoClass}">${estadoText}</td>
                    <td>${t.usadoEn ? new Date(t.usadoEn).toLocaleString() : '---'}</td>
                `;
                tbody.appendChild(tr);
            });

            msgDiv.className = 'message success';
            msgDiv.innerText = `✅ ${data.total} boletas encontradas.`;
            tableContainer.style.display = 'block';
        } else {
            throw new Error(data.error || 'Error al cargar');
        }
    } catch (error) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ ' + error.message;
        tableContainer.style.display = 'none';
    }
}
// =============================================
// Validar con Cámara (Corregida)
// =============================================
function startScanner() {
    const valMessage = document.getElementById('valMessage');
    valMessage.className = 'message';
    valMessage.innerText = 'Encendiendo cámara...';
    document.getElementById('btnStartScan').style.display = 'none';
    document.getElementById('btnScanAgain').style.display = 'none';
    document.getElementById('btnStopScan').style.display = 'block';

    html5QrCode = new Html5Qrcode("reader");
    
    // Usamos la configuración estándar que funcionaba en Opera
    html5QrCode.start(
        { facingMode: "environment" }, 
        { 
            fps: 15, 
            qrbox: { width: 180, height: 180 } // Mantenemos la caja pequeña para QR pequeños
        },
        onScanSuccess,
        () => {}
    ).catch(err => {
        valMessage.className = 'message error';
        valMessage.innerText = '❌ No se pudo acceder a la cámara.';
        document.getElementById('btnStartScan').style.display = 'block';
        document.getElementById('btnStopScan').style.display = 'none';
    });
}

async function onScanSuccess(decodedText) {
    stopScanner();
    const valMessage = document.getElementById('valMessage');
    valMessage.className = 'message warning';
    valMessage.innerText = '⏳ Validando...';

    try {
        const response = await fetch(`${API_URL}/tickets/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: decodedText })
        });
        const data = await response.json();
        if (data.valido) {
            valMessage.className = 'message success';
            valMessage.innerText = `✅ ACCESO PERMITIDO - ${data.serial}`;
        } else {
            valMessage.className = 'message error';
            valMessage.innerText = `❌ DENEGADO - ${data.motivo}`;
        }
    } catch (error) {
        valMessage.className = 'message error';
        valMessage.innerText = '❌ Error de conexión.';
    } finally {
        document.getElementById('btnScanAgain').style.display = 'block';
    }
}

function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error(err));
    }
    document.getElementById('btnStartScan').style.display = 'block';
    document.getElementById('btnStopScan').style.display = 'none';
}

// =============================================
// Descargar PDF
// =============================================
async function downloadPdf() {
    const desde = document.getElementById('desdePdf').value;
    const hasta = document.getElementById('hastaPdf').value;
    const msgDiv = document.getElementById('pdfMessage');

    if (!adminToken) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ Debes iniciar sesión como admin primero.';
        return;
    }

    if (!desde || !hasta) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ Completa el rango.';
        return;
    }

    msgDiv.className = 'message warning';
    msgDiv.innerText = '⏳ Generando PDF...';

    try {
        const response = await fetch(`${API_URL}/tickets/download-pdf?desde=${desde}&hasta=${hasta}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!response.ok) throw new Error('Error o rango sin tickets');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `tickets-${desde}-a-${hasta}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        msgDiv.className = 'message success';
        msgDiv.innerText = '✅ PDF descargado.';
    } catch (error) {
        msgDiv.className = 'message error';
        msgDiv.innerText = '❌ ' + error.message;
    }
}