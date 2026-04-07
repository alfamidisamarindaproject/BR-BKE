// Konfigurasi URL API Google Sheet Anda
const API_URL = "https://script.google.com/macros/s/AKfycbzujly75H_753-WoJ9ToJsW72HK9OOWXU6SYlB2WiHbXsc1_uCuzg0TDyIFgJb6f-SN/exec";

// Inisialisasi saat web dimuat
document.addEventListener("DOMContentLoaded", () => {
    fetchDataDariGoogleSheet();
});

// Fungsi fetch ke Google Script
async function fetchDataDariGoogleSheet() {
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Gagal ke server Google. Kode: ${response.status}`);
        }
        
        const rawData = await response.json();
        
        if (rawData.error) throw new Error(rawData.error);
        
        // Mematikan loader dan menampilkan konten utama
        document.getElementById('loader').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        
        // Mulai memproses dan menggambar data
        processAndRenderData(rawData); 
        
    } catch (error) {
        console.error("Gagal Render:", error);
        document.getElementById('loader').innerHTML = `
            <div class="text-danger text-center mt-5">
                <i class="fas fa-circle-exclamation fa-3x mb-3"></i>
                <h4 class="fw-bold">Gagal Memuat Database</h4>
                <p>${error.message}</p>
                <button class="btn btn-outline-danger mt-2" onclick="location.reload()">Coba Lagi</button>
            </div>
        `;
    }
}

// Utility: Format Rupiah & Pembersih Angka
const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
const parseAngka = (val) => parseFloat((val || '0').toString().replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;

// Logika Utama: Pengolahan Data (Tabel & Grafik)
function processAndRenderData(data) {
    const sheet1 = data.sheet1; // Transaksi
    const sheet2 = data.sheet2; // Master Toko
    
    // Hapus baris header
    sheet1.shift(); 
    sheet2.shift();

    // 1. Buat "Kamus" Data Toko (agar pencarian cepat)
    const masterToko = {};
    sheet2.forEach(row => {
        let kdToko = row[0] ? row[0].toString().trim() : "";
        masterToko[kdToko] = {
            nama: row[1] || "-",
            ac: row[2] || "-",
            am: row[3] || "-",
            wilayah: row[4] || "-"
        };
    });

    // 2. Variabel Penampung Kalkulasi
    let totalQty = 0, totalRp = 0;
    let tokoSet = new Set();
    let tipeCount = { "BR": 0, "BKE": 0 };
    
    let chartTrend = {}, chartDept = {}, chartWilayah = {}, chartToko = {};
    let htmlRows = "";

    // 3. Looping Data Transaksi
    sheet1.forEach(row => {
        let tgl = row[0] || "-";
        let kdToko = row[1] ? row[1].toString().trim() : "-";
        let tipe = row[2] || "-";
        let plu = row[3] || "-";
        let desc = row[4] || "-";
        let qty = parseAngka(row[5]);
        let avgCost = parseAngka(row[6]);
        let dept = row[7] || "Lainnya";
        let totHarga = qty * avgCost;

        // Ambil info dari kamus toko
        let info = masterToko[kdToko] || { nama: "Tidak Ditemukan", ac: "-", am: "-", wilayah: "-" };

        // Kalkulasi KPI
        totalQty += qty;
        totalRp += totHarga;
        tokoSet.add(kdToko);
        if (tipe === "BR" || tipe === "BKE") tipeCount[tipe]++;

        // Kalkulasi Grafik
        chartTrend[tgl] = (chartTrend[tgl] || 0) + totHarga;
        chartDept[dept] = (chartDept[dept] || 0) + qty;
        chartWilayah[info.wilayah] = (chartWilayah[info.wilayah] || 0) + totHarga;
        
        let labelToko = `${kdToko} - ${info.nama}`;
        chartToko[labelToko] = (chartToko[labelToko] || 0) + qty;

        // Pembuatan Baris Tabel HTML
        let badgeTipe = tipe === 'BR' ? 'bg-warning text-dark' : (tipe === 'BKE' ? 'bg-danger' : 'bg-secondary');
        htmlRows += `
            <tr>
                <td class="text-nowrap">${tgl}</td>
                <td><span class="fw-bold">${kdToko}</span><br><small class="text-muted">${info.nama}</small></td>
                <td><small>AC: ${info.ac}<br>AM: ${info.am}<br>Wil: <b>${info.wilayah}</b></small></td>
                <td><span class="badge ${badgeTipe}">${tipe}</span></td>
                <td><span class="fw-bold">${plu}</span><br><small class="text-muted">${desc}</small></td>
                <td>${dept}</td>
                <td class="fw-bold text-center">${qty.toLocaleString('id-ID')}</td>
                <td class="fw-bold text-success text-end" data-order="${totHarga}">${formatRp(totHarga)}</td>
            </tr>
        `;
    });

    // 4. Update Angka KPI di HTML
    document.getElementById('kpi-qty').innerText = totalQty.toLocaleString('id-ID');
    document.getElementById('kpi-rp').innerText = formatRp(totalRp);
    document.getElementById('kpi-toko').innerText = tokoSet.size.toLocaleString('id-ID');
    document.getElementById('kpi-tipe').innerText = tipeCount["BR"] >= tipeCount["BKE"] ? "BR" : "BKE";

    // 5. Inisialisasi DataTables (Tabel Pencarian Interaktif)
    document.getElementById('table-data').innerHTML = htmlRows;
    $('#dataTable').DataTable({
        language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/id.json' },
        pageLength: 10,
        responsive: true,
        order: [[0, "desc"]] // Urutkan dari tanggal terbaru
    });

    // 6. Gambar Grafik (Chart.js)
    Chart.defaults.font.family = "'Inter', sans-serif";
    const warnadasar = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

    // A. Trend Harian (Line)
    const tglSort = Object.keys(chartTrend).sort();
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: tglSort,
            datasets: [{
                label: 'Nilai Retur',
                data: tglSort.map(d => chartTrend[d]),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 3, fill: true, tension: 0.4
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatRp(c.raw) } } }, scales: { y: { ticks: { callback: (v) => formatRp(v) } } } }
    });

    // B. Dept (Doughnut)
    new Chart(document.getElementById('deptChart'), {
        type: 'doughnut',
        data: { labels: Object.keys(chartDept), datasets: [{ data: Object.values(chartDept), backgroundColor: warnadasar, borderWidth: 0 }] },
        options: { maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
    });

    // C. Wilayah (Bar Chart Horizontal)
    const sortWil = Object.entries(chartWilayah).sort((a,b) => b[1]-a[1]);
    new Chart(document.getElementById('wilayahChart'), {
        type: 'bar',
        data: { labels: sortWil.map(x => x[0]), datasets: [{ label: 'Total Rupiah', data: sortWil.map(x => x[1]), backgroundColor: '#0ea5e9', borderRadius: 6 }] },
        options: { maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatRp(c.raw) } } }, scales: { x: { ticks: { callback: (v) => formatRp(v) } } } }
    });

    // D. Top 5 Toko (Bar)
    const sortToko = Object.entries(chartToko).sort((a,b) => b[1]-a[1]).slice(0, 5);
    new Chart(document.getElementById('tokoChart'), {
        type: 'bar',
        data: { labels: sortToko.map(x => x[0].split(' - ')[1] || x[0]), datasets: [{ label: 'Total QTY', data: sortToko.map(x => x[1]), backgroundColor: '#f59e0b', borderRadius: 6 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}
