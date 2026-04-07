// MASUKKAN URL WEB APP GOOGLE APPS SCRIPT ANDA DI SINI
const API_URL = 'https://script.google.com/macros/s/AKfycbx4X0dPuU4xeZOuTqcrt2eoal9hq1itHwfpqbYuewUKn97QUTgaHTRuipaPBSJESOn5/exec';

let globalData = [];
let trendChartInstance = null;

// Eksekusi saat halaman HTML selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  fetchDataFromAPI();
});

// Fetch API dari Google Apps Script
async function fetchDataFromAPI() {
  try {
    const response = await fetch(API_URL);
    
    // Pengecekan jika URL GAS salah dan mengembalikan HTML (bukan JSON)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("text/html") !== -1) {
        throw new Error("Tolong periksa deployment Google Apps Script Anda. Pastikan disetel sebagai 'Web App' dan aksesnya 'Siapa saja' (Anyone).");
    }

    const result = await response.json();
    
    if (result.status === "success") {
      globalData = result.data;
      
      // Sembunyikan layar loading dan tampilkan konten utama
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
      
      const dashboardContent = document.getElementById('dashboard-content');
      if (dashboardContent) dashboardContent.style.display = 'block';

      // Mulai proses perhitungan dan render
      processAndRenderDashboard();
    } else {
      console.error("API Error:", result.message);
      showError("Gagal mengambil data dari Spreadsheet.");
    }
  } catch (error) {
    console.error("Error Fetch:", error);
    showError(error.message || "Gagal terkoneksi ke Server. Cek koneksi internet atau link API Anda.");
  }
}

// Menampilkan pesan error di layar loading jika API gagal
function showError(msg) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.innerHTML = `
      <div style="color: #ef4444; margin-bottom: 1rem;"><i class="fas fa-exclamation-triangle fa-3x"></i></div>
      <h4 style="color: #1f2937; font-weight: bold;">Terjadi Kesalahan</h4>
      <p style="color: #6b7280; text-align: center; max-width: 400px;">${msg}</p>
    `;
  }
}

// Proses Data & Update Seluruh UI
function processAndRenderDashboard() {
  let totalNet = 0; 
  let totalQty = 0; 
  let trendData = {};
  
  let tokoSet = new Set();
  let tipeSet = {};

  globalData.forEach(item => {
    // Memastikan angka valid (mencegah error NaN)
    let net = Number(item.net) || 0;
    let qty = Number(item.qty) || 0;
    
    totalNet += net; 
    totalQty += qty;
    
    if (item.kd_toko) tokoSet.add(item.kd_toko);
    if (item.ket) tipeSet[item.ket] = (tipeSet[item.ket] || 0) + 1;

    // Memastikan tanggal terbaca sebagai string dengan aman
    let dateStr = item.tgl_retur ? String(item.tgl_retur) : "Unknown";
    let dateKey = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

    // Agregasi untuk Chart
    if (!trendData[dateKey]) trendData[dateKey] = { net: 0, qty: 0 };
    trendData[dateKey].net += net;
    trendData[dateKey].qty += qty;
  });

  // Mencari Tipe Retur/BKE yang paling mendominasi
  let dominasiTipe = "-";
  let maxTipe = 0;
  for (let ket in tipeSet) {
      if (tipeSet[ket] > maxTipe) {
          maxTipe = tipeSet[ket];
          dominasiTipe = ket;
      }
  }

  // Update Angka di Kartu (KPI)
  const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  setHtml('kpi-rp', new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalNet));
  setHtml('kpi-qty', new Intl.NumberFormat('id-ID').format(totalQty));
  setHtml('kpi-toko', new Intl.NumberFormat('id-ID').format(tokoSet.size));
  setHtml('kpi-tipe', dominasiTipe);

  // Render Grafik
  const sortedDates = Object.keys(trendData).sort();
  renderTrendChart(sortedDates, sortedDates.map(d => trendData[d].net), sortedDates.map(d => trendData[d].qty));

  // Render DataTables
  renderTable();
}

// Merender Grafik Chart.js
function renderTrendChart(labels, dataNet, dataQty) {
  const elChart = document.getElementById('trendChart');
  if (!elChart) return;

  const ctx = elChart.getContext('2d');
  if (trendChartInstance) trendChartInstance.destroy();

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Total Rupiah (NET)', data: dataNet, borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderWidth: 3, pointRadius: 4, fill: true, tension: 0.4, yAxisID: 'y' },
        { label: 'Total Kuantitas (QTY)', data: dataQty, type: 'bar', backgroundColor: 'rgba(16, 185, 129, 0.8)', borderRadius: 4, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false } },
        y: { type: 'linear', position: 'left', title: { display: true, text: 'Rupiah' } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'QTY' } }
      }
    }
  });
}

// Merender Tabel menggunakan DataTables & Bootstrap
function renderTable() {
  const tableBody = document.getElementById('table-data');
  if (!tableBody) return;
  
  let html = '';
  globalData.forEach(item => {
      let dateStr = item.tgl_retur ? String(item.tgl_retur) : "";
      let tgl = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      
      html += `
      <tr>
          <td><span class="text-muted">${tgl}</span></td>
          <td class="fw-semibold">${item.kd_toko || '-'} <br><small class="text-muted fw-normal">${item.nama_toko || '-'}</small></td>
          <td>${item.wilayah || '-'}</td>
          <td><span class="badge ${item.ket === 'BKE' ? 'bg-danger' : 'bg-primary'}">${item.ket || '-'}</span></td>
          <td><small>${item.plu || '-'}</small><br>${item.descp || '-'}</td>
          <td>-</td>
          <td class="fw-bold">${item.qty || 0}</td>
          <td class="text-success fw-bold">Rp ${new Intl.NumberFormat('id-ID').format(Number(item.net) || 0)}</td>
      </tr>`;
  });
  
  // Hapus instansi DataTables lama jika ada agar tidak bentrok
  if ($.fn.DataTable.isDataTable('#dataTable')) {
      $('#dataTable').DataTable().destroy();
  }
  
  tableBody.innerHTML = html;
  
  // Inisialisasi DataTables UI
  $('#dataTable').DataTable({
      pageLength: 10,
      ordering: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/id.json' }
  });
}
