// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = 'https://corpgiuxyhfxdnqwwmlv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBnaXV4eWhmeGRucXd3bWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDMwNzcsImV4cCI6MjA4NTg3OTA3N30.PMp5yZOISYrBG0UUcIGaXUPnmEAaWVKgQ3Y1W8Nea_E';
const SYNC_ID = 'user_data_utama'; // ID unik untuk baris di tabel

const supabaseClient = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- DATA LOGIC ---
const MASTER_KEY = 'pantau_setoran_master_data';
let loans = JSON.parse(localStorage.getItem(MASTER_KEY) || '[]').map(l => standarisasiData(l));
let activeLoanIndex = null;

function standarisasiData(l) {
    return {
        id: l.id || Date.now() + Math.random(),
        nama: l.nama || "Tanpa Nama",
        total: parseInt(l.total) || 0,
        bunga: parseFloat(l.bunga) || 0,
        setoran: parseInt(l.setoran) || 0,
        durasi: parseInt(l.durasi) || 1,
        tglJatuhTempo: parseInt(l.tglJatuhTempo) || 1,
        riwayat: Array.isArray(l.riwayat) ? l.riwayat : []
    };
}

// Fungsi Merge: Gabungkan data tanpa duplikat berdasarkan ID
function mergeData(newData) {
    newData.forEach(newItem => {
        const item = standarisasiData(newItem);
        const idx = loans.findIndex(l => l.id === item.id);
        if (idx > -1) { loans[idx] = item; } else { loans.push(item); }
    });
    saveAndRender();
}

function saveAndRender() {
    localStorage.setItem(MASTER_KEY, JSON.stringify(loans));
    render();
}

// --- GLOBAL FUNCTIONS (Fixing 'is not defined') ---
window.toggleModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
};

window.toggleDetails = (id) => {
    document.getElementById(id).classList.toggle('active');
};

window.bukaModalSetup = (index = null) => {
    activeLoanIndex = index;
    const isEdit = index !== null;
    document.getElementById('setup-title').innerText = isEdit ? "Edit Pinjaman" : "Pinjaman Baru";
    if (isEdit) {
        const l = loans[index];
        document.getElementById('input-nama').value = l.nama;
        document.getElementById('input-total').value = l.total;
        document.getElementById('input-bunga').value = l.bunga;
        document.getElementById('input-setoran').value = l.setoran;
        document.getElementById('input-durasi').value = l.durasi;
        document.getElementById('input-tgl').value = l.tglJatuhTempo;
    } else {
        document.querySelectorAll('#modal-setup input').forEach(i => i.value = '');
    }
    toggleModal('modal-setup');
};

window.simpanPinjaman = () => {
    const d = {
        nama: document.getElementById('input-nama').value || "Pinjaman",
        total: parseInt(document.getElementById('input-total').value) || 0,
        bunga: parseFloat(document.getElementById('input-bunga').value) || 0,
        setoran: parseInt(document.getElementById('input-setoran').value) || 0,
        durasi: parseInt(document.getElementById('input-durasi').value) || 1,
        tglJatuhTempo: parseInt(document.getElementById('input-tgl').value) || 1
    };
    if (activeLoanIndex !== null) {
        loans[activeLoanIndex] = { ...loans[activeLoanIndex], ...d };
    } else {
        d.id = Date.now(); d.riwayat = [];
        loans.push(d);
    }
    saveAndRender();
    toggleModal('modal-setup');
};

window.hapusPinjaman = (idx) => {
    if(confirm("Hapus pinjaman ini?")) { loans.splice(idx,1); saveAndRender(); }
};

window.bukaModalBayar = (lIdx, hIdx = null) => {
    activeLoanIndex = lIdx;
    const l = loans[lIdx];
    document.getElementById('edit-history-index').value = (hIdx !== null) ? hIdx : "";
    document.getElementById('bayar-untuk-nama').innerText = l.nama;
    if (hIdx !== null) {
        document.getElementById('bayar-tgl').value = l.riwayat[hIdx].tgl;
        document.getElementById('bayar-nominal').value = l.riwayat[hIdx].nominal;
    } else {
        document.getElementById('bayar-tgl').valueAsDate = new Date();
        document.getElementById('bayar-nominal').value = l.setoran;
    }
    toggleModal('modal-bayar');
};

window.prosesSimpanBayar = () => {
    const hIdx = document.getElementById('edit-history-index').value;
    const tgl = document.getElementById('bayar-tgl').value;
    const nominal = parseInt(document.getElementById('bayar-nominal').value);
    if(!tgl || !nominal) return;
    if (hIdx !== "") {
        loans[activeLoanIndex].riwayat[hIdx] = { tgl, nominal };
    } else {
        loans[activeLoanIndex].riwayat.push({ tgl, nominal });
    }
    saveAndRender();
    toggleModal('modal-bayar');
};

window.hapusRiwayat = (lIdx, rIdx) => {
    if(confirm("Hapus catatan ini?")) { loans[lIdx].riwayat.splice(rIdx,1); saveAndRender(); }
};

// --- SINKRONISASI ---
window.uploadKeSupabase = async () => {
    const btn = document.getElementById('btn-upload'); btn.disabled = true;
    try {
        await supabaseClient.from('pantau_setoran_sync').upsert({ id: SYNC_ID, data: loans, updated_at: new Date() });
        alert("✅ Berhasil Upload!");
    } catch (e) { alert("Gagal: " + e.message); }
    btn.disabled = false;
};

window.downloadDariSupabase = async () => {
    try {
        const { data } = await supabaseClient.from('pantau_setoran_sync').select('data').eq('id', SYNC_ID).single();
        if(data) { mergeData(data.data); alert("✅ Data Digabungkan!"); }
    } catch (e) { alert("Gagal Download."); }
};

window.backupData = () => {
    const blob = new Blob([JSON.stringify(loans, null, 2)], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Backup_${new Date().toLocaleDateString()}.json`; a.click();
};

window.restoreData = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { mergeData(JSON.parse(ev.target.result)); alert("✅ Data Digabungkan!"); };
    reader.readAsText(e.target.files[0]);
};

// --- RENDER ---
function render() {
    const container = document.getElementById('loan-list');
    container.innerHTML = '';
    const query = document.getElementById('search-input').value.toLowerCase();
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    loans.filter(l => l.nama.toLowerCase().includes(query)).forEach((loan, idx) => {
        const lIdx = loans.findIndex(orig => orig.id === loan.id);
        const totalWajib = loan.total + (loan.total * (loan.bunga / 100));
        const terbayar = loan.riwayat.reduce((s, i) => s + i.nominal, 0);
        const sisa = totalWajib - terbayar;
        const persen = (terbayar / totalWajib) * 100;

        const item = document.createElement('div');
        item.innerHTML = `
            <div class="tg-item" onclick="toggleDetails('det-${lIdx}')">
                <div class="tg-avatar" style="background:${sisa <= 0 ? '#94a3b8' : colors[lIdx % colors.length]}">${loan.nama[0].toUpperCase()}</div>
                <div class="tg-content">
                    <div style="display:flex; justify-content:space-between">
                        <span class="tg-title">${loan.nama}</span>
                        <span style="font-size:0.7rem; color:#94a3b8">Tgl ${loan.tglJatuhTempo}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:4px">
                        <span class="tg-subtitle">Sisa: Rp ${Math.max(0, sisa).toLocaleString()}</span>
                        <span class="tg-badge ${sisa > 0 ? 'warning' : ''}">${sisa <= 0 ? 'LUNAS' : loan.riwayat.length+'/'+loan.durasi}</span>
                    </div>
                </div>
            </div>
            <div id="det-${lIdx}" class="tg-details">
                <div style="display:flex; justify-content:space-between; align-items:center">
                    <small>Pokok: Rp ${loan.total.toLocaleString()} (${loan.bunga}%)</small>
                    <div>
                        <button class="btn-edit-sm" onclick="bukaModalSetup(${lIdx})">Edit</button>
                        <button class="btn-danger-sm" onclick="hapusPinjaman(${lIdx})">✕</button>
                    </div>
                </div>
                <div class="progress-container"><div class="progress-fill" style="width:${persen}%; background:${sisa<=0?'#10b981':'#3b82f6'}"></div></div>
                <button class="btn btn-success w-100" onclick="bukaModalBayar(${lIdx})">+ Catat Pembayaran</button>
                <div style="margin-top:15px">
                    <label>RIWAYAT:</label>
                    ${loan.riwayat.map((h, rIdx) => `
                        <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding:5px 0; border-bottom:1px dashed #e2e8f0">
                            <span>${h.tgl} - <b>Rp ${h.nominal.toLocaleString()}</b></span>
                            <span style="color:red; cursor:pointer" onclick="hapusRiwayat(${lIdx}, ${rIdx})">✕</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', render);
