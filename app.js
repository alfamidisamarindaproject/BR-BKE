// MASUKKAN URL WEB APP GOOGLE APPS SCRIPT ANDA DI SINI
const API_URL = 'https://script.google.com/macros/s/AKfycbx4X0dPuU4xeZOuTqcrt2eoal9hq1itHwfpqbYuewUKn97QUTgaHTRuipaPBSJESOn5/exec';

let globalData = [];
let filteredData = [];
let chartInstance = null;

// Eksekusi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  fetchDataFromAPI();
  setupEventListeners();
});

// Fetch API dari Google Apps Script
async function fetchDataFromAPI() {
  try {
    const response = await fetch(API_URL);
    const result = await response.json();
    
    if (result.status === "success") {
      globalData = result.data;
      filteredData = result.data;
      
      // PERBAIKAN 1: Sembunyikan loader dan TAMPILKAN konten dashboard
      const loader = document.getElementById('loader');
      if(loader) loader.style.display = 'none';
      
      const dashboardContent = document.getElementById('dashboard-content');
      if(dashboardContent) dashboardContent.style.display = 'block';
      
      // PERBAIKAN 2: Cegah error jika badge tidak ada di HTML
      const badge = document.getElementById('loading-badge');
      if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-check-circle mr-2"></i> API Terhubung (${globalData.length} baris)`;
        badge.classList.replace('bg-indigo-500', 'bg-emerald-500');
      }

      populateFilterDropdowns(globalData);
      processAndRenderDashboard();
    } else {
      console.error("API Error:", result.message);
      alert("Gagal memuat data dari API.");
    }
  } catch (error) {
    console.error("Fetch failed:", error);
    const badge = document.getElementById('loading-badge');
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> Gagal Koneksi API`;
      badge.classList.replace('bg-indigo-500', 'bg-red-500');
    } else {
      alert("Gagal Koneksi API. Cek console browser.");
    }
  }
}

// Logika Dropdown Filter (Dilindungi null-checker)
function populateFilterDropdowns(data) {
  const sets = { wilayah: new Set(), am: new Set(), ac: new Set(), ket: new Set() };

  data.forEach(item => {
    if(item.wilayah && item.wilayah !== 'N/A') sets.wilayah.add(item.wilayah);
    if(item.am && item.am !== 'N/A') sets.am.add(item.am);
    if(item.ac && item.ac !== 'N/A') sets.ac.add(item.ac);
    if(item.ket) sets.ket.add(item.ket);
  });

  const fillSelect = (id, dataSet) => {
    const el = document.getElementById(id);
    if (!el) return; // Cegah error jika elemen filter tidak ada di HTML
    Array.from(dataSet).sort().forEach(val => {
      let opt = document.createElement('option');
      opt.value = val; opt.text = val; el.add(opt);
    });
  };

  fillSelect('filterWilayah', sets.wilayah);
  fillSelect('filterAM', sets.am);
  fillSelect('filterAC', sets.ac);
  fillSelect('filterKet', sets.ket);
}

// Event Listeners Input
function setupEventListeners() {
  ['searchToko', 'filterWilayah', 'filterAM', 'filterAC', 'filterKet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { // Cek eksistensi
      el.addEventListener(id === 'searchToko' ? 'input' : 'change', applyFilters);
    }
  });

  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const searchToko = document.getElementById('searchToko');
      if(searchToko) searchToko.value = '';
      
      ['filterWilayah', 'filterAM', 'filterAC', 'filterKet'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = 'ALL';
      });
      applyFilters();
    });
  }
}

// Filter Engine
function applyFilters() {
  const searchWord = document.getElementById('searchToko') ? document.getElementById('searchToko').value.toLowerCase().trim() : '';
  const valWilayah = document.getElementById('filterWilayah') ? document.getElementById('filterWilayah').value : 'ALL';
  const valAM = document.getElementById('filterAM') ? document.getElementById('filterAM').value : 'ALL';
  const valAC = document.getElementById('filterAC') ? document.getElementById('filterAC').value : 'ALL';
  const valKet = document.getElementById('filterKet') ? document.getElementById('filterKet').value : 'ALL';

  filteredData = globalData.filter(d => {
    const matchSearch = (d.kd_toko.toLowerCase().includes(searchWord) || d.nama_toko.toLowerCase().includes(searchWord));
    const matchWilayah = valWilayah === 'ALL' || d.wilayah === valWilayah;
    const matchAM = valAM === 'ALL' || d.am === valAM;
    const matchAC = valAC === 'ALL' || d.ac === valAC;
    const matchKet = valKet === 'ALL' || d.ket === valKet;
    return matchSearch && matchWilayah && matchAM && matchAC && matchKet;
  });

  processAndRenderDashboard();
}

// Proses Data & Update UI
function processAndRenderDashboard() {
  let totalNet = 0; 
  let totalQty = 0; 
  let trendData = {};
  
  // Variabel untuk menghitung Toko dan Dominasi Tipe
  let tokoSet = new Set();
  let tipeSet = {};

  filteredData.forEach(item => {
    totalNet += item.net; 
    totalQty += item.qty;
    
    if(item.kd_toko) tokoSet.add(item.kd_toko);
    if(item.ket) tipeSet[item.ket] = (tipeSet[item.ket] || 0) + 1;

    let dateKey = item.tgl_retur.includes('T') ? item.tgl_retur.split('T')[0] : item.tgl_retur;
    if(!trendData[dateKey]) trendData[dateKey] = { net: 0, qty: 0 };
    trendData[dateKey].net += item.net;
    trendData[dateKey].qty += item.qty;
  });

  // Cari tipe (KET) yang paling mendominasi
  let dominasiTipe = "-";
  let maxTipe = 0;
  for (let ket in tipeSet) {
      if (tipeSet[ket] > maxTipe) {
          maxTipe = tipeSet[ket];
          dominasiTipe = ket;
      }
  }

  // PERBAIKAN 3: Sinkronisasi nama ID HTML baru dengan Javascript
  const elNet = document.getElementById('kpi-rp');
  const elQty = document.getElementById('kpi-qty');
  const elToko = document.getElementById('kpi-toko');
  const elTipe = document.getElementById('kpi-tipe');

  if(elNet) elNet.innerText = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalNet);
  if(elQty) elQty.innerText = new Intl.NumberFormat('id-ID').format(totalQty);
  if(elToko) elToko.innerText = new Intl.NumberFormat('id-ID').format(tokoSet.size);
  if(elTipe) elTipe.innerText = dominasiTipe;

  // Render Grafik Trend
  const sortedDates = Object.keys(trendData).sort();
  renderTrendChart(sortedDates, sortedDates.map(d => trendData[d].net), sortedDates.map(d => trendData[d].qty));

  // Render DataTables
  renderTable();
}

// Fungsi Render Tabel untuk DataTables UI Bootstrap
function renderTable() {
  const tableBody = document.getElementById('table-data');
  if (!tableBody) return;
  
  let html = '';
  filteredData.forEach(item => {
      let tgl = item.tgl_retur.includes('T') ? item.tgl_retur.split('T')[0] : item.tgl_retur;
      html += `
      <tr>
          <td>${tgl}</td>
          <td>${item.kd_toko} - ${item.nama_toko}</td>
          <td>${item.wilayah}</td>
          <td>${item.ket}</td>
          <td>${item.plu} - ${item.descp}</td>
          <td>-</td>
          <td>${item.qty}</td>
          <td>Rp ${new Intl.NumberFormat('id-ID').format(item.net)}</td>
      </tr>`;
  });
  
  // Hancurkan DataTables lama jika ada agar tidak bentrok saat filter
  if ($.fn.DataTable.isDataTable('#dataTable')) {
      $('#dataTable').DataTable().destroy();
  }
  
  tableBody.innerHTML = html;
  
  // Re-inisialisasi DataTables
  $('#dataTable').DataTable({
      pageLength: 10,
      ordering: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/id.json' }
  });
}

// Chart.js Rendering
function renderTrendChart(labels, dataNet, dataQty) {
  const elChart = document.getElementById('trendChart');
  if (!elChart) return;

  const ctx = elChart.getContext('2d');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Total Rupiah (NET)', data: dataNet, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderWidth: 3, pointRadius: 4, fill: true, tension: 0.4, yAxisID: 'y' },
        { label: 'Total Kuantitas (QTY)', data: dataQty, type: 'bar', backgroundColor: 'rgba(16, 185, 129, 0.8)', borderRadius: 4, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false } },
        y: { type: 'linear', position: 'left', title: { display: true, text: 'Nilai Netto (Rupiah)' } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Jumlah Kuantitas' } }
      }
    }
  });
}
