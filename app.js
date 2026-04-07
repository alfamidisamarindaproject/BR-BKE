<script>
document.addEventListener("DOMContentLoaded", () => {
    // Memanggil data menggunakan API bawaan Google Apps Script (Lebih cepat & tanpa CORS)
    google.script.run
        .withSuccessHandler(processAndRenderData)
        .withFailureHandler(showError)
        .getDashboardData();
});

function showError(errorMsg) {
    console.error(errorMsg);
    document.getElementById('loader').innerHTML = `
        <div class="text-danger text-center mt-5">
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <h4>Gagal Memuat Data</h4>
            <p>${errorMsg}</p>
        </div>
    `;
}

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
};

// Membersihkan format angka dari sheet yang mungkin terbaca sebagai string
const parseNumber = (val) => {
    if(!val) return 0;
    if(typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/,/g, '').replace(/\./g, '')) || 0;
};

function processAndRenderData(jsonString) {
    const rawData = JSON.parse(jsonString);
    
    if(rawData.error) {
        showError(rawData.error);
        return;
    }

    const { sheet1, sheet2 } = rawData;
    sheet1.shift(); // Hapus Header
    sheet2.shift(); // Hapus Header

    const dataToko = {};
    sheet2.forEach(row => {
        let kdToko = row[0] ? row[0].toString().trim() : "";
        dataToko[kdToko] = {
            namaToko: row[1] || "-",
            ac: row[2] || "-",
            am: row[3] || "-",
            wilayah: row[4] || "-"
        };
    });

    let grandTotalQty = 0, grandTotalRp = 0;
    let setTokoAktif = new Set();
    let counterTipe = { "BR": 0, "BKE": 0 };
    let sumByDate = {}, sumByDept = {}, sumByWilayah = {}, sumByToko = {};
    let htmlTable = "";

    sheet1.forEach((row, index) => {
        let tglFormat = row[0]; // Karena pakai getDisplayValues, format sudah rapi dari sheet
        let kodeData = row[1] ? row[1].toString().trim() : "";
        let ket = row[2];
        let plu = row[3];
        let descp = row[4];
        let qty = parseNumber(row[5]);
        let avgCost = parseNumber(row[6]);
        let totalHarga = qty * avgCost;
        let dept = row[7] || "Lainnya";

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

        // Tampilkan semua data untuk DataTables (tidak di-limit 100 lagi)
        let badgeWarna = ket === 'BR' ? 'bg-warning text-dark' : 'bg-danger';
        htmlTable += `
            <tr>
                <td class="fw-bold text-secondary">${tglFormat}</td>
                <td><span class="fw-bold">${kodeData}</span><br><small class="text-muted">${infoToko.namaToko}</small></td>
                <td><span class="badge bg-light text-dark border">AC: ${infoToko.ac}</span> <br> <span class="badge bg-light text-dark border mt-1">AM: ${infoToko.am}</span></td>
                <td><span class="badge ${badgeWarna}">${ket || '-'}</span></td>
                <td><span class="fw-bold">${plu}</span><br><small class="text-muted">${descp}</small></td>
                <td>${dept}</td>
                <td><span class="badge bg-info text-dark">${infoToko.wilayah}</span></td>
                <td class="fw-bold text-center">${qty.toLocaleString('id-ID')}</td>
                <td class="fw-bold text-success" data-order="${totalHarga}">${formatRupiah(totalHarga)}</td>
            </tr>
        `;
    });

    document.getElementById('loader').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'block';
    
    // Insert data tabel
    document.getElementById('table-data').innerHTML = htmlTable;
    
    // Inisialisasi DataTables untuk fitur Search & Pagination
    $('#dataTable').DataTable({
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/id.json'
        },
        pageLength: 10,
        responsive: true
    });

    // Update KPI
    document.getElementById('kpi-qty').innerText = grandTotalQty.toLocaleString('id-ID');
    document.getElementById('kpi-rp').innerText = formatRupiah(grandTotalRp);
    document.getElementById('kpi-toko').innerText = setTokoAktif.size.toLocaleString('id-ID');
    document.getElementById('kpi-tipe').innerText = counterTipe["BR"] >= counterTipe["BKE"] ? "BR" : "BKE";

    // Global Chart Configuration
    Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";
    const colors = ['#1e3c72', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#34495e'];

    // 1. Trend Chart
    const dates = Object.keys(sumByDate).sort();
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Total Nilai Retur (Rp)',
                data: dates.map(d => sumByDate[d]),
                borderColor: '#1e3c72',
                backgroundColor: 'rgba(30, 60, 114, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#1e3c72',
                pointRadius: 4
            }]
        },
        options: { 
            responsive: true, 
            plugins: { 
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => formatRupiah(ctx.raw) } }
            },
            scales: { y: { ticks: { callback: (val) => formatRupiah(val) } } }
        }
    });

    // 2. Dept Doughnut Chart
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
        options: { responsive: true, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });

    // 3. Wilayah Bar Chart
    const sortWilayah = Object.entries(sumByWilayah).sort((a,b) => b[1]-a[1]);
    new Chart(document.getElementById('wilayahChart'), {
        type: 'bar',
        data: {
            labels: sortWilayah.map(x => x[0]),
            datasets: [{
                label: 'Total Rupiah',
                data: sortWilayah.map(x => x[1]),
                backgroundColor: '#3498db',
                borderRadius: 6
            }]
        },
        options: { 
            responsive: true, 
            plugins: { 
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => formatRupiah(ctx.raw) } }
            },
            scales: { y: { ticks: { callback: (val) => formatRupiah(val) } } }
        }
    });

    // 4. Toko Teratas Bar Chart
    const sortToko = Object.entries(sumByToko).sort((a,b) => b[1]-a[1]).slice(0, 5);
    new Chart(document.getElementById('tokoChart'), {
        type: 'bar',
        data: {
            labels: sortToko.map(x => x[0].split('-')[1] || x[0]), // Hanya tampilkan nama toko agar rapi
            datasets: [{
                label: 'Total QTY',
                data: sortToko.map(x => x[1]),
                backgroundColor: '#f1c40f',
                borderRadius: 6
            }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });
}
</script>
