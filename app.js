// URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = 'https://script.google.com/macros/s/AKfycbzT4RFVgQv6WS0k9fPmXf_zTEd8FDIG-DD0onfGbSn7EmCLMDlF4Ndt0i8LzciSnw/exec';

let globalData = [];
let filteredData = [];
let maxDateObj = new Date(); 

// Instansi Grafik
let trendChart = null;
let deptChart = null;
let wilayahChart = null;
let tokoChart = null;

// Warna Tema
const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#64748b', '#14b8a6'];

document.addEventListener('DOMContentLoaded', () => {
  fetchDataFromAPI();
});

// Menarik Data dari Google Sheets via API
async function fetchDataFromAPI() {
  try {
    const response = await fetch(API_URL);
    const result = await response.json();
    
    if (result.status === "success") {
      globalData = result.data;
      filteredData = result.data;

      // Temukan tanggal terakhir di dataset untuk acuan MTD & YTD
      if (globalData.length > 0) {
        let maxTime = Math.max(...globalData.map(d => new Date(d.tgl_retur).getTime()));
        if (!isNaN(maxTime)) maxDateObj = new Date(maxTime);
      }
      
      // Sembunyikan layar loading, tampilkan dashboard
      document.getElementById('loader').style.display = 'none';
      document.getElementById('dashboard-content').style.display = 'block';

      populateFilterDropdowns(globalData);
      setupEventListeners();
      processAndRenderDashboard();
    } else {
      document.getElementById('loader-text').innerText = "Data tidak dapat dimuat: " + result.message;
      document.getElementById('loader-text').style.color = "red";
    }
  } catch (error) {
    console.error("Fetch failed:", error);
    document.getElementById('loader-text').innerHTML = "Gagal terkoneksi ke Server. Cek link API.";
    document.getElementById('loader-text').style.color = "red";
  }
}

// 1. Mengisi Pilihan Filter ke Dropdown
function populateFilterDropdowns(data) {
  const sets = { wilayah: new Set(), am: new Set(), ac: new Set() };

  data.forEach(item => {
    if(item.wilayah && item.wilayah !== 'N/A') sets.wilayah.add(item.wilayah);
    if(item.am && item.am !== 'N/A') sets.am.add(item.am);
    if(item.ac && item.ac !== 'N/A') sets.ac.add(item.ac);
  });

  const fillSelect = (id, dataSet) => {
    const el = document.getElementById(id);
    if (!el) return;
    Array.from(dataSet).sort().forEach(val => {
      let opt = document.createElement('option');
      opt.value = val; opt.text = val; el.add(opt);
    });
  };

  fillSelect('filterWilayah', sets.wilayah);
  fillSelect('filterAM', sets.am);
  fillSelect('filterAC', sets.ac);
}

// 2. Memantau Input User di Panel Filter
function setupEventListeners() {
  ['filterSearch', 'filterPeriode', 'filterWilayah', 'filterAM', 'filterAC'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener(id === 'filterSearch' ? 'input' : 'change', applyFilters);
  });

  const btnReset = document.getElementById('btnReset');
  if(btnReset) {
    btnReset.addEventListener('click', () => {
      document.getElementById('filterSearch').value = '';
      ['filterPeriode', 'filterWilayah', 'filterAM', 'filterAC'].forEach(id => document.getElementById(id).value = 'ALL');
      applyFilters();
    });
  }
}

// 3. Logika Pemfilteran Data (Search, Periode Waktu, Dropdowns)
function applyFilters() {
  const searchWord = document.getElementById('filterSearch') ? document.getElementById('filterSearch').value.toLowerCase().trim() : '';
  const valPeriode = document.getElementById('filterPeriode') ? document.getElementById('filterPeriode').value : 'ALL';
  const valWilayah = document.getElementById('filterWilayah') ? document.getElementById('filterWilayah').value : 'ALL';
  const valAM = document.getElementById('filterAM') ? document.getElementById('filterAM').value : 'ALL';
  const valAC = document.getElementById('filterAC') ? document.getElementById('filterAC').value : 'ALL';

  filteredData = globalData.filter(d => {
    // A. Filter Search Toko
    const matchSearch = (d.kd_toko.toLowerCase().includes(searchWord) || d.nama_toko.toLowerCase().includes(searchWord));
    
    // B. Filter Waktu (MTD / YTD)
    let matchPeriode = true;
    if (valPeriode !== 'ALL' && d.tgl_retur) {
      let itemDate = new Date(d.tgl_retur);
      let isSameYear = itemDate.getFullYear() === maxDateObj.getFullYear();
      let isSameMonth = itemDate.getMonth() === maxDateObj.getMonth();
      
      if (valPeriode === 'MTD') matchPeriode = (isSameYear && isSameMonth);
      if (valPeriode === 'YTD') matchPeriode = isSameYear;
    }

    // C. Filter Area
    const matchWilayah = valWilayah === 'ALL' || d.wilayah === valWilayah;
    const matchAM = valAM === 'ALL' || d.am === valAM;
    const matchAC = valAC === 'ALL' || d.ac === valAC;

    return matchSearch && matchPeriode && matchWilayah && matchAM && matchAC;
  });

  processAndRenderDashboard();
}

// 4. Kalkulasi Data Dashboard dan Memicu Render Chart
function processAndRenderDashboard() {
  let totalNet = 0; let totalQty = 0; 
  let tokoSet = new Set(); let tipeSet = {};
  
  // Wadah Agregasi untuk Chart
  let mapTrend = {}; let mapDept = {}; let mapWilayah = {}; let mapToko = {};

  filteredData.forEach(item => {
    let net = Number(item.net) || 0;
    let qty = Number(item.qty) || 0;

    // Metrik Umum
    totalNet += net; totalQty += qty;
    if (item.kd_toko) tokoSet.add(item.kd_toko);
    if (item.ket) tipeSet[item.ket] = (tipeSet[item.ket] || 0) + 1;

    // A. Data Trend (Berdasarkan Tanggal)
    let dateStr = item.tgl_retur ? String(item.tgl_retur) : "Unknown";
    let dateKey = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    if(!mapTrend[dateKey]) mapTrend[dateKey] = { net: 0, qty: 0 };
    mapTrend[dateKey].net += net;
    mapTrend[dateKey].qty += qty;

    // B. Data Departemen (Berdasarkan Kategori)
    let deptName = item.kategori || item.ket || 'Lainnya';
    mapDept[deptName] = (mapDept[deptName] || 0) + net;

    // C. Data Wilayah (Berdasarkan Rupiah)
    let wilayahName = item.wilayah || 'Lainnya';
    mapWilayah[wilayahName] = (mapWilayah[wilayahName] || 0) + net;

    // D. Data Top Toko (Berdasarkan QTY)
    let tokoName = item.kd_toko + ' - ' + (item.nama_toko.split(' ')[0] || ''); 
    mapToko[tokoName] = (mapToko[tokoName] || 0) + qty;
  });

  // Update UI KPI Atas
  let dominasiTipe = Object.keys(tipeSet).reduce((a, b) => tipeSet[a] > tipeSet[b] ? a : b, "-");
  
  const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  setHtml('kpi-rp', new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalNet));
  setHtml('kpi-qty', new Intl.NumberFormat('id-ID').format(totalQty));
  setHtml('kpi-toko', new Intl.NumberFormat('id-ID').format(tokoSet.size));
  setHtml('kpi-tipe', dominasiTipe);

  // Render Seluruh Visualisasi
  renderChartTrend(mapTrend);
  renderChartDept(mapDept);
  renderChartWilayah(mapWilayah);
  renderChartToko(mapToko);
  renderTable();
}

// === FUNGSI-FUNGSI RENDER CHART JS & DATATABLES === //

function renderChartTrend(mapData) {
  const ctx = document.getElementById('trendChart');
  if(!ctx) return;
  const sortedDates = Object.keys(mapData).sort();
  
  if(trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [
        { label: 'Rupiah (NET)', data: sortedDates.map(d => mapData[d].net), borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: true, tension: 0.4, yAxisID: 'y' },
        { label: 'Kuantitas (QTY)', data: sortedDates.map(d => mapData[d].qty), type: 'bar', backgroundColor: 'rgba(16, 185, 129, 0.8)', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false } }, y: { type: 'linear', position: 'left' }, y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } } }
    }
  });
}

function renderChartDept(mapData) {
  const ctx = document.getElementById('deptChart');
  if(!ctx) return;
  const labels = Object.keys(mapData);
  const data = Object.values(mapData);

  if(deptChart) deptChart.destroy();
  deptChart = new Chart(ctx, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });
}

function renderChartWilayah(mapData) {
  const ctx = document.getElementById('wilayahChart');
  if(!ctx) return;
  const labels = Object.keys(mapData);
  const data = Object.values(mapData);

  if(wilayahChart) wilayahChart.destroy();
  wilayahChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });
}

function renderChartToko(mapData) {
  const ctx = document.getElementById('tokoChart');
  if(!ctx) return;
  
  // Ambil 5 Terbesar Saja
  let sortedToko = Object.keys(mapData).map(k => ({ nama: k, qty: mapData[k] })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  
  if(tokoChart) tokoChart.destroy();
  tokoChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedToko.map(t => t.nama),
      datasets: [{ label: 'Total QTY Retur', data: sortedToko.map(t => t.qty), backgroundColor: '#f59e0b', borderRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
  });
}

function renderTable() {
  const tableBody = document.getElementById('table-data');
  if (!tableBody) return;
  
  let html = '';
  filteredData.forEach(item => {
      let tgl = item.tgl_retur ? String(item.tgl_retur).split('T')[0] : '';
      html += `<tr>
          <td><span class="text-muted">${tgl}</span></td>
          <td class="fw-semibold">${item.kd_toko || '-'} <br><small class="text-muted fw-normal">${item.nama_toko || '-'}</small></td>
          <td>${item.wilayah || '-'}</td>
          <td><span class="badge ${item.ket === 'BKE' ? 'bg-danger' : 'bg-primary'}">${item.ket || '-'}</span></td>
          <td><small>${item.plu || '-'}</small><br>${item.descp || '-'}</td>
          <td>${item.kategori || item.ket || '-'}</td>
          <td class="fw-bold">${item.qty || 0}</td>
          <td class="text-success fw-bold">Rp ${new Intl.NumberFormat('id-ID').format(Number(item.net) || 0)}</td>
      </tr>`;
  });
  
  // Menghancurkan tabel lama (untuk filter re-rendering yang bersih)
  if ($.fn.DataTable.isDataTable('#dataTable')) $('#dataTable').DataTable().destroy();
  
  tableBody.innerHTML = html;
  
  // Mengaktifkan Datatables dengan bahasa Indonesia
  $('#dataTable').DataTable({ 
      pageLength: 10, 
      ordering: true, 
      language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/id.json' }
  });
}
