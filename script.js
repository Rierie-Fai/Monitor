// Menggunakan v6 untuk memastikan skema data visual terbaru aktif
let loans = JSON.parse(localStorage.getItem('pwa_loan_data_v6')) || [];
let activeLoanIndex = null;

const hasNotificationSupport = () => {
    return ("Notification" in window) && (typeof Notification !== 'undefined');
};

function toggleModal(id) {
    const modal = document.getElementById(id);
    if(modal) {
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    }
}

function bukaModalSetup(index = null) {
    activeLoanIndex = index;
    const isEdit = index !== null;
    document.getElementById('setup-title').innerText = isEdit ? "Edit Pinjaman" : "Pinjaman Baru";
    
    if (isEdit) {
        const loan = loans[index];
        document.getElementById('input-nama').value = loan.nama;
        document.getElementById('input-total').value = loan.total;
        document.getElementById('input-setoran').value = loan.setoran;
        document.getElementById('input-durasi').value = loan.durasi;
        document.getElementById('input-tgl').value = loan.tglJatuhTempo;
    } else {
        document.querySelectorAll('#modal-setup input').forEach(i => i.value = '');
    }
    toggleModal('modal-setup');
}

function simpanPinjaman() {
    const dataBaru = {
        nama: document.getElementById('input-nama').value || "Pinjaman",
        total: parseInt(document.getElementById('input-total').value) || 0,
        setoran: parseInt(document.getElementById('input-setoran').value) || 0,
        durasi: parseInt(document.getElementById('input-durasi').value) || 1,
        tglJatuhTempo: parseInt(document.getElementById('input-tgl').value) || 1,
    };

    if (activeLoanIndex !== null) {
        loans[activeLoanIndex] = { ...loans[activeLoanIndex], ...dataBaru };
    } else {
        dataBaru.id = Date.now();
        dataBaru.riwayat = [];
        loans.push(dataBaru);
    }
    saveAndRender();
    toggleModal('modal-setup');
}

function hapusPinjaman(index) {
    if (confirm("Hapus seluruh data pinjaman ini?")) {
        loans.splice(index, 1);
        saveAndRender();
    }
}

function bukaModalBayar(loanIndex, historyIndex = null) {
    activeLoanIndex = loanIndex;
    const isEdit = historyIndex !== null;
    document.getElementById('edit-history-index').value = isEdit ? historyIndex : "";
    document.getElementById('bayar-title').innerText = isEdit ? "Edit Pembayaran" : "Catat Pembayaran";
    
    const loan = loans[loanIndex];
    document.getElementById('bayar-untuk-nama').innerText = loan.nama;

    if (isEdit) {
        const h = loan.riwayat[historyIndex];
        document.getElementById('bayar-tgl').value = h.tgl;
        document.getElementById('bayar-nominal').value = h.nominal;
    } else {
        document.getElementById('bayar-tgl').valueAsDate = new Date();
        document.getElementById('bayar-nominal').value = loan.setoran;
    }
    toggleModal('modal-bayar');
}

function prosesSimpanBayar() {
    const hIndex = document.getElementById('edit-history-index').value;
    const tgl = document.getElementById('bayar-tgl').value;
    const nominal = parseInt(document.getElementById('bayar-nominal').value);

    if (!tgl || !nominal) return alert("Isi tanggal dan nominal!");

    const record = { tgl, nominal };

    if (hIndex !== "") {
        loans[activeLoanIndex].riwayat[hIndex] = record;
    } else {
        loans[activeLoanIndex].riwayat.push(record);
    }
    saveAndRender();
    toggleModal('modal-bayar');
}

function hapusRiwayat(loanIndex, historyIndex) {
    if (confirm("Hapus catatan pembayaran ini?")) {
        loans[loanIndex].riwayat.splice(historyIndex, 1);
        saveAndRender();
    }
}

function saveAndRender() {
    localStorage.setItem('pwa_loan_data_v6', JSON.stringify(loans));
    render();
}

function backupData() {
    if (loans.length === 0) return alert("Belum ada data untuk di-backup!");
    const dataStr = JSON.stringify(loans, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_setoran_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                if(confirm("Tumpuk data saat ini dengan data dari file backup?")) {
                    loans = importedData;
                    saveAndRender();
                    alert("Data berhasil dipulihkan!");
                }
            } else { alert("Format file tidak valid."); }
        } catch (err) { alert("Gagal membaca file JSON."); }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Fungsi Notifikasi Desktop Real
function kirimNotif(judul, pesan) {
    if (hasNotificationSupport() && Notification.permission === "granted") {
        new Notification(judul, { body: pesan, icon: "icon-192.png" });
    }
}

function render() {
    const container = document.getElementById('loan-list');
    if(!container) return;
    container.innerHTML = '';

    if (loans.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; margin-top:50px;">Belum ada data. Klik + Pinjaman.</p>`;
        return;
    }

    const hariIni = new Date().getDate();

    loans.forEach((loan, lIdx) => {
        const totalTerbayar = loan.riwayat.reduce((sum, item) => sum + item.nominal, 0);
        const sudahBayarKali = loan.riwayat.length;
        const sisaUtang = loan.total - totalTerbayar;
        const persen = (sudahBayarKali / loan.durasi) * 100;

        // Logika H-10 sampai Hari H
        const tglTempo = parseInt(loan.tglJatuhTempo);
        let isWarning = false;
        let warningText = "";

        if (sudahBayarKali < loan.durasi) {
            const selisih = tglTempo - hariIni;
            // Jika selisih antara 0 sampai 10 hari
            if (selisih <= 10 && selisih >= 0) {
                isWarning = true;
                warningText = selisih === 0 ? "JATUH TEMPO HARI INI!" : `TEMPO DALAM ${selisih} HARI`;
            }
        }

        const card = document.createElement('div');
        card.className = `card ${isWarning ? 'warning' : ''}`;
        card.innerHTML = `
            <div class="loan-header">
                <div>
                    <strong style="font-size: 1.1rem;">${loan.nama}</strong><br>
                    <small class="text-muted">Tempo: Tanggal ${loan.tglJatuhTempo}</small>
                    ${isWarning ? `<br><span class="badge-warning">${warningText}</span>` : ''}
                </div>
                <div class="loan-actions">
                    <button class="btn-edit-sm" onclick="bukaModalSetup(${lIdx})">Edit</button>
                    <button class="btn-danger-sm" onclick="hapusPinjaman(${lIdx})">✕</button>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(persen, 100)}%; background: ${isWarning ? '#ef4444' : '#22c55e'}"></div>
            </div>
            <div class="stats-grid">
                <div class="stat-item"><small>STATUS</small><strong>${sudahBayarKali}/${loan.durasi}</strong></div>
                <div class="stat-item"><small>SISA HUTANG</small><strong style="color:var(--danger)">Rp ${Math.max(0, sisaUtang).toLocaleString('id-ID')}</strong></div>
            </div>
            <button class="btn ${isWarning ? 'btn-primary' : 'btn-success'}" onclick="bukaModalBayar(${lIdx})">✔ Catat Pembayaran</button>
            <div class="history-detail">
                <p style="margin: 10px 0 5px 0; font-size: 0.75rem; font-weight: bold; color: #64748b;">RIWAYAT PEMBAYARAN:</p>
                ${loan.riwayat.length === 0 ? '<small class="text-muted">Belum ada pembayaran</small>' : 
                    loan.riwayat.map((h, hIdx) => `
                        <div class="history-row">
                            <div class="history-info">
                                <span>${new Date(h.tgl).toLocaleDateString('id-ID')}</span>
                                <small class="text-success">Rp ${h.nominal.toLocaleString('id-ID')}</small>
                            </div>
                            <div class="history-actions">
                                <button class="btn-edit-sm" onclick="bukaModalBayar(${lIdx}, ${hIdx})">Edit</button>
                                <button class="btn-danger-sm" onclick="hapusRiwayat(${lIdx}, ${hIdx})">✕</button>
                            </div>
                        </div>
                    `).join('')}
            </div>
        `;
        container.appendChild(card);

        // Jalankan notifikasi jika pas hari H atau H-1
        if (isWarning && (tglTempo - hariIni <= 1)) {
            kirimNotif("Pengingat Setoran", `Cicilan ${loan.nama} sudah dekat!`);
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    render();
    if (hasNotificationSupport()) {
        Notification.requestPermission();
    }
});
