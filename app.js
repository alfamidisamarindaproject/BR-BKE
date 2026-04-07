// Masukkan link URL Web App Anda di sini
const API_URL = "https://script.google.com/macros/s/AKfycbxUfIn-shvtmt0K98b39rqC4wYo8d2S83p9UFDJ6bYOMD0fuS58v15Q1MNSYGbY4tHR/exec";

document.addEventListener("DOMContentLoaded", () => {
    // Panggil fungsi fetch saat halaman dimuat
    fetchDataDariGoogleSheet();
});

// Fungsi untuk mengambil data via URL
async function fetchDataDariGoogleSheet() {
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawData = await response.json();
        
        // Lempar data ke fungsi kalkulasi
        processAndRenderData(rawData);
        
    } catch (error) {
        console.error("Gagal mengambil data:", error);
        document.getElementById('loader').innerHTML = `
            <div class="text-danger">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <h4>Gagal Memuat Data</h4>
                <p>Pastikan URL benar dan Akses Deployment diatur ke "Siapa saja".</p>
            </div>
        `;
    }
}

// Format Uang Rupiah
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

// ==========================================
// SISA KODE DI BAWAH INI SAMA PERSIS DENGAN SEBELUMNYA
// ==========================================
function processAndRenderData(rawData) {
    const { sheet1, sheet2 } = rawData;

    // Hapus baris pertama (Header)
    sheet1.shift(); 
    sheet2.shift();

    // 1. PROSES PENGGABUNGAN (JOIN) DATA
    const dataToko = {};
    sheet2.forEach(row => {
        let kdToko = row[0] ? row[0].toString().trim() : "";
        dataToko[kdToko] = {
            namaToko: row[1],
            ac: row[2],
            am: row[3],
            wilayah: row[4]
        };
    });

    let grandTotalQty = 0;
    let grandTotalRp = 0;
    let setTokoAktif = new Set();
    let counterTipe = { "BR": 0, "BKE": 0 };
    
    let sumByDate = {};
    let sumByDept = {};
    let sumByWilayah = {};
    let sumByToko = {};

    let htmlTable = "";

    sheet1.forEach((row, index) => {
        let tgl = new Date(row[0]);
        let tglFormat = !isNaN(tgl) ? tgl.toLocaleDateString('id-ID') : row[0];
        let kodeData = row[1] ? row[1].toString().trim() : "";
        let ket = row[2];
        let plu = row[3];
        let descp = row[4];
        let qty = parseFloat(row[5]) || 0;
        let avgCost = parseFloat(row[6]) || 0;
        let dept = row[7];
        
        let totalHarga = qty * avgCost;

        let infoToko = dataToko[kodeData] || { namaToko: "Tidak Diketahui", ac: "-", am: "-", wilayah: "-" };

        grandTotalQty += qty;
        grandTotalRp += totalHarga;
        if(kodeData) setTokoAktif.add(kodeData);
        if(ket === "BR" || ket === "BKE") counterTipe[ket]++;

        sumByDate[tglFormat] = (sumByDate[tglFormat] || 0) + totalHarga;
        sumByDept[dept] = (sumByDept[dept] || 0) + qty;
        sumByWilayah[infoToko.wilayah] = (sumByWilayah[infoToko.wilayah] || 0) + totalHarga;
        
        let labelToko = `${kodeData} - ${infoToko.namaToko}`;
        sumByToko[labelToko] = (sumByToko[labelToko] || 0) + qty;

        if(index < 100) {
            let badgeWarna = ket === 'BR' ? 'bg-warning text-dark' : 'bg-danger';
            htmlTable += `
                <tr>
                    <td class="fw-bold text-secondary">${tglFormat}</td>
                    <td><span class="fw-bold">${kodeData}</span><br><small class="text-muted">${infoToko.namaToko}</small></td>
                    <td><span class="badge bg-light text-dark border">AC: ${infoToko.ac}</span> <br> <span class="badge bg-light text-dark border mt-1">AM: ${infoToko.am}</span></td>
                    <td><span class="badge ${badgeWarna}">${ket}</span></td>
                    <td><span class="fw-bold">${plu}</span><br><small class="text-muted">${descp}</small></td>
                    <td>${dept}</td>
                    <td><span class="badge bg-info text-dark">${infoToko.wilayah}</span></td>
                    <td class="fw-bold text-center">${qty}</td>
                    <td class="fw-bold text-success">${formatRupiah(totalHarga)}</td>
                </tr>
            `;
        }
    });

    document.getElementById('loader').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'block';

    document.getElementById('table-data').innerHTML = htmlTable;

    document.getElementById('kpi-qty').innerText = grandTotalQty.toLocaleString('id-ID');
    document.getElementById('kpi-rp').innerText = formatRupiah(grandTotalRp);
    document.getElementById('kpi-toko').innerText = setTokoAktif.size;
    document.getElementById('kpi-tipe').innerText = counterTipe["BR"] > counterTipe["BKE"] ? "BR" : "BKE";

    const colors = ['#2c5364', '#e74c3c', '#f1c40f', '#3498db', '#9b59b6', '#1abc9c'];

    const dates = Object.keys(sumByDate).sort();
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Total Nilai Retur (Rp)',
                data: dates.map(d => sumByDate[d]),
                borderColor: '#2c5364',
                backgroundColor: 'rgba(44, 83, 100, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('deptChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(sumByDept),
            datasets: [{
                data: Object.values(sumByDept),
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
    });

    const sortWilayah = Object.entries(sumByWilayah).sort((a,b) => b[1]-a[1]);
    new Chart(document.getElementById('wilayahChart'), {
        type: 'bar',
        data: {
            labels: sortWilayah.map(x => x[0]),
            datasets: [{
                label: 'Total Rupiah',
                data: sortWilayah.map(x => x[1]),
                backgroundColor: '#3498db',
                borderRadius: 5
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    const sortToko = Object.entries(sumByToko).sort((a,b) => b[1]-a[1]).slice(0, 5);
    new Chart(document.getElementById('tokoChart'), {
        type: 'bar',
        data: {
            labels: sortToko.map(x => x[0]),
            datasets: [{
                label: 'Total QTY',
                data: sortToko.map(x => x[1]),
                backgroundColor: '#f1c40f',
                borderRadius: 5
            }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });
}
