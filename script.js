// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = 'https://corpgiuxyhfxdnqwwmlv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBnaXV4eWhmeGRucXd3bWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDMwNzcsImV4cCI6MjA4NTg3OTA3N30.PMp5yZOISYrBG0UUcIGaXUPnmEAaWVKgQ3Y1W8Nea_E';
const SYNC_ID = 'user_data_utama';

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

// --- LOGIKA TANGGAL & NOTIFIKASI ---
function cekSudahBayarBulanIni(loan) {
    const sekarang = new Date();
    const blnSekarang = sekarang.getMonth() + 1;
    const thnSekarang = sekarang.getFullYear();
    
    return loan.riwayat.some(h => {
        // Cek target bulan & tahun dari input, fallback ke tgl bayar jika data lama
        const b = h.bulan || (new Date(h.tgl).getMonth() + 1);
        const t = h.tahun || new Date(h.tgl).getFullYear();
        return b === blnSekarang && t === thnSekarang;
    });
}

function dapatkanTanggalTempoLengkap(tglInput) {
    const sekarang = new Date();
    let tglTempo = new Date(sekarang.getFullYear(), sekarang.getMonth(), tglInput);
    if (tglTempo < sekarang && sekarang.getDate() > tglInput) {
        tglTempo = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, tglInput);
    }
    tglTempo.setHours(0, 0, 0, 0);
    return tglTempo;
}

function hitungSelisihHari(tglTarget) {
    const sekarang = new Date();
    sekarang.setHours(0, 0, 0, 0);
    const diff = tglTarget - sekarang;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function mintaIzinNotifikasi() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
        document.getElementById('btn-notif').classList.add('active');
        new Notification("Pantau Pro", { body: "Notifikasi Berhasil Diaktifkan!" });
        cekJatuhTempoDanNotif();
    }
}

function cekJatuhTempoDanNotif() {
    if (Notification.permission !== "granted") return;
    let pesan = "";
    let ada = false;

    loans.forEach(loan => {
        const totalWajib = loan.total + (loan.total * (loan.bunga/100));
        const terbayar = loan.riwayat.reduce((s,i)=> s + i.nominal, 0);
        const sisa = totalWajib - terbayar;
        
        const sudahBayar = cekSudahBayarBulanIni(loan);
        const tglTempo = dapatkanTanggalTempoLengkap(loan.tglJatuhTempo);
        const selisih = hitungSelisihHari(tglTempo);

        if (sisa > 0 && !sudahBayar) {
            if (selisih === 0) { pesan += `🔴 HARI INI: ${loan.nama}\n`; ada = true; }
            else if (selisih > 0 && selisih <= 3) { pesan += `⏳ H-${selisih}: ${loan.nama}\n`; ada = true; }
        }
    });

    if (ada) new Notification("Pengingat Setoran", { body: pesan });
}

// --- SINKRONISASI OTOMATIS (CLOUD) ---
async function saveAndRender() {
    localStorage.setItem(MASTER_KEY, JSON.stringify(loans));
    render();
    autoBackupKeSupabase();
}

async function autoBackupKeSupabase() {
    const indicator = document.getElementById('sync-indicator');
    if (indicator) indicator.style.display = 'block';

    try {
        if (!supabaseClient) throw new Error("Supabase Belum Config");
        await supabaseClient.from('pantau_setoran_sync').upsert({ 
            id: SYNC_ID, 
            data: loans, 
            updated_at: new Date() 
        });
        console.log("☁️ Auto-Backup Sukses");
    } catch (e) {
        console.error("☁️ Auto-Backup Gagal:", e);
    } finally {
        if (indicator) setTimeout(() => indicator.style.display = 'none', 1500);
    }
}

async function autoRestoreDariCloud() {
    try {
        const { data, error } = await supabaseClient
            .from('pantau_setoran_sync')
            .select('data')
            .eq('id', SYNC_ID)
            .single();

        if (data && data.data) {
            mergeData(data.data);
            console.log("✅ Auto-Restore Sukses");
        }
    } catch (e) {
        console.log("ℹ️ Cloud Kosong atau Offline");
    }
}

function mergeData(newData) {
    newData.forEach(newItem => {
        const item = standarisasiData(newItem);
        const idx = loans.findIndex(l => l.id === item.id);
        if (idx > -1) {
            loans[idx] = item; 
        } else {
            loans.push(item);
        }
    });
    localStorage.setItem(MASTER_KEY, JSON.stringify(loans));
    render();
}

// --- GLOBAL ACTIONS ---
window.toggleModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
};

window.toggleDetails = (id) => document.getElementById(id).classList.toggle('active');

// Fungsi untuk toggle (buka/tutup) riwayat tahunan
window.toggleYear = (id, el) => {
    const content = document.getElementById(id);
    if (content) {
        content.classList.toggle('active');
        el.classList.toggle('active');
    }
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
        d.id = Date.now(); d.riwayat = []; loans.push(d);
    }
    saveAndRender();
    toggleModal('modal-setup');
};

// --- LOGIKA PEMBAYARAN BARU ---
window.bukaModalBayar = (lIdx, hIdx = null) => {
    activeLoanIndex = lIdx;
    const l = loans[lIdx];
    document.getElementById('bayar-untuk-nama').innerText = l.nama;
    document.getElementById('edit-history-index').value = hIdx !== null ? hIdx : "";
    
    if (hIdx !== null) {
        document.getElementById('bayar-tgl').value = l.riwayat[hIdx].tgl;
        document.getElementById('bayar-nominal').value = l.riwayat[hIdx].nominal;
        document.getElementById('bayar-bulan').value = l.riwayat[hIdx].bulan || new Date(l.riwayat[hIdx].tgl).getMonth() + 1;
        document.getElementById('bayar-tahun').value = l.riwayat[hIdx].tahun || new Date(l.riwayat[hIdx].tgl).getFullYear();
    } else {
        const now = new Date();
        document.getElementById('bayar-tgl').valueAsDate = now;
        document.getElementById('bayar-nominal').value = l.setoran;
        document.getElementById('bayar-bulan').value = now.getMonth() + 1;
        document.getElementById('bayar-tahun').value = now.getFullYear();
    }
    toggleModal('modal-bayar');
};

window.prosesSimpanBayar = () => {
    const hIdx = document.getElementById('edit-history-index').value;
    const tgl = document.getElementById('bayar-tgl').value;
    const nominal = parseInt(document.getElementById('bayar-nominal').value);
    const bulan = parseInt(document.getElementById('bayar-bulan').value);
    const tahun = parseInt(document.getElementById('bayar-tahun').value);
    
    if(!tgl || !nominal || !bulan || !tahun) return;
    
    const dataBayar = { tgl, nominal, bulan, tahun };

    if (hIdx !== "") {
        loans[activeLoanIndex].riwayat[hIdx] = dataBayar;
    } else {
        loans[activeLoanIndex].riwayat.push(dataBayar);
    }

    // Auto Sorting: Tahun terbaru -> Bulan terbaru -> Tanggal terbaru
    loans[activeLoanIndex].riwayat.sort((a, b) => {
        const tahunA = a.tahun || new Date(a.tgl).getFullYear();
        const tahunB = b.tahun || new Date(b.tgl).getFullYear();
        if (tahunB !== tahunA) return tahunB - tahunA;
        
        const bulanA = a.bulan || new Date(a.tgl).getMonth() + 1;
        const bulanB = b.bulan || new Date(b.tgl).getMonth() + 1;
        if (bulanB !== bulanA) return bulanB - bulanA;
        
        return new Date(b.tgl) - new Date(a.tgl);
    });

    saveAndRender();
    toggleModal('modal-bayar');
};

window.hapusPinjaman = (idx) => { if(confirm("Hapus pinjaman?")) { loans.splice(idx,1); saveAndRender(); } };
window.hapusRiwayat = (lIdx, rIdx) => { if(confirm("Hapus riwayat pembayaran ini?")) { loans[lIdx].riwayat.splice(rIdx,1); saveAndRender(); } };

window.manualUpload = () => autoBackupKeSupabase().then(() => alert("Terunggah!"));
window.manualDownload = () => autoRestoreDariCloud().then(() => alert("Selesai!"));

window.backupData = () => {
    const blob = new Blob([JSON.stringify(loans, null, 2)], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Backup_Setoran_${new Date().toISOString().slice(0,10)}.json`; a.click();
};

window.restoreData = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { mergeData(JSON.parse(ev.target.result)); alert("Berhasil Restore!"); };
    reader.readAsText(e.target.files[0]);
};

// --- RENDER UI ---
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

        const sudahBayar = cekSudahBayarBulanIni(loan);
        const selisih = hitungSelisihHari(dapatkanTanggalTempoLengkap(loan.tglJatuhTempo));
        const isWarning = (sisa > 0) && !sudahBayar && (selisih <= 10);

        let badgeText = sisa <= 0 ? 'LUNAS' : `${loan.riwayat.length}/${loan.durasi}`;
        if (sudahBayar && sisa > 0) badgeText = "OK BULAN INI";
        else if (isWarning) badgeText = (selisih === 0) ? "HARI INI" : `H-${selisih}`;

        const item = document.createElement('div');
        item.innerHTML = `
            <div class="tg-item" onclick="toggleDetails('det-${lIdx}')">
                <div class="tg-avatar" style="background:${sisa <= 0 ? '#cbd5e1' : colors[lIdx % colors.length]}">${loan.nama[0].toUpperCase()}</div>
                <div class="tg-content">
                    <div style="display:flex; justify-content:space-between">
                        <span class="tg-title">${loan.nama}</span>
                        <span style="font-size:0.7rem; color:#94a3b8">Tempo: Tgl ${loan.tglJatuhTempo}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:4px">
                        <span class="tg-subtitle">Sisa: Rp ${Math.max(0, sisa).toLocaleString()}</span>
                        <span class="tg-badge ${isWarning ? 'warning' : ''} ${sudahBayar && sisa > 0 ? 'ok' : ''}">${badgeText}</span>
                    </div>
                </div>
            </div>
            
            <div id="det-${lIdx}" class="tg-details">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
                    <small>Pokok: Rp ${loan.total.toLocaleString()} (+${loan.bunga}%)</small>
                    <div>
                        <button class="btn-edit-sm" onclick="event.stopPropagation(); bukaModalSetup(${lIdx})">Edit</button>
                        <button class="btn-danger-sm" onclick="event.stopPropagation(); hapusPinjaman(${lIdx})">✕</button>
                    </div>
                </div>
                
                <div class="progress-container"><div class="progress-fill" style="width:${persen}%; background:${sisa<=0?'#10b981':'#3b82f6'}"></div></div>
                <button class="btn btn-success w-100" onclick="event.stopPropagation(); bukaModalBayar(${lIdx})">+ Catat Pembayaran</button>
                
                <div style="margin-top:15px">
                    <label>RIWAYAT PEMBAYARAN:</label>
                    ${(() => {
                        if (loan.riwayat.length === 0) return '<p style="font-size:0.7rem; color:grey">Belum ada riwayat</p>';
                        
                        const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                        const grouped = {};
                        
                        // Grouping data berdasarkan tahun, simpan originalIndex untuk fungsi hapus
                        loan.riwayat.forEach((h, rIdx) => {
                            const year = h.tahun || new Date(h.tgl).getFullYear();
                            if (!grouped[year]) grouped[year] = [];
                            grouped[year].push({ ...h, originalIndex: rIdx });
                        });

                        let riwayatHTML = '';
                        // Mengurutkan tahun secara descending (terbaru di atas)
                        const sortedYears = Object.keys(grouped).sort((a, b) => b - a);
                        
                        sortedYears.forEach((year, yIdx) => {
                            const totalPerTahun = grouped[year].reduce((sum, h) => sum + h.nominal, 0);
                            const collapseId = `year-${lIdx}-${year}`;
                            
                            // Jika index 0 (tahun terbaru), set active agar langsung terbuka
                            const isActiveClass = yIdx === 0 ? 'active' : '';

                            riwayatHTML += `
                                <div class="year-group-header ${isActiveClass}" onclick="event.stopPropagation(); toggleYear('${collapseId}', this)">
                                    <span>Tahun ${year} <span class="year-summary">(Total: Rp ${totalPerTahun.toLocaleString()})</span></span>
                                </div>
                                <div id="${collapseId}" class="year-content ${isActiveClass}">
                                    ${grouped[year].map(h => {
                                        const blnStr = h.bulan ? namaBulan[h.bulan - 1] : namaBulan[new Date(h.tgl).getMonth()];
                                        return `
                                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; padding:8px 0; border-bottom:1px dashed #e2e8f0">
                                                <div>
                                                    <div style="font-weight:700; color:var(--primary); margin-bottom:2px">${blnStr} ${year}</div>
                                                    <div style="font-size:0.7rem; color:var(--muted)">Tgl Bayar: ${h.tgl}</div>
                                                </div>
                                                <div style="text-align:right">
                                                    <div style="font-weight:700; margin-bottom:2px">Rp ${h.nominal.toLocaleString()}</div>
                                                    <div style="color:var(--danger); cursor:pointer; font-size:0.7rem; font-weight:600" onclick="event.stopPropagation(); hapusRiwayat(${lIdx}, ${h.originalIndex})">✕ Hapus</div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `;
                        });
                        return riwayatHTML;
                    })()}
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Render data awal
    render();
    
    // 2. Cek Notifikasi
    if (Notification.permission === "granted") {
        document.getElementById('btn-notif').classList.add('active');
        cekJatuhTempoDanNotif();
    }

    // 3. Auto-Restore Cloud
    autoRestoreDariCloud();
});
