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
      
      document.getElementById('loader').style.display = 'none';
      document.getElementById('trendChart').style.display = 'block';
      
      const badge = document.getElementById('loading-badge');
      badge.innerHTML = `<i class="fa-solid fa-check-circle mr-2"></i> API Terhubung (${globalData.length} baris)`;
      badge.classList.replace('bg-indigo-500', 'bg-emerald-500');

      populateFilterDropdowns(globalData);
      processAndRenderDashboard();
    } else {
      console.error("API Error:", result.message);
      alert("Gagal memuat data dari API.");
    }
  } catch (error) {
    console.error("Fetch failed:", error);
    document.getElementById('loading-badge').innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> Gagal Koneksi API`;
    document.getElementById('loading-badge').classList.replace('bg-indigo-500', 'bg-red-500');
  }
}

// Logika Dropdown Filter
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
    document.getElementById(id).addEventListener(id === 'searchToko' ? 'input' : 'change', applyFilters);
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('searchToko').value = '';
    ['filterWilayah', 'filterAM', 'filterAC', 'filterKet'].forEach(id => document.getElementById(id).value = 'ALL');
    applyFilters();
  });
}

// Filter Engine
function applyFilters() {
  const searchWord = document.getElementById('searchToko').value.toLowerCase().trim();
  const valWilayah = document.getElementById('filterWilayah').value;
  const valAM = document.getElementById('filterAM').value;
  const valAC = document.getElementById('filterAC').value;
  const valKet = document.getElementById('filterKet').value;

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
  let totalNet = 0; let totalQty = 0; let trendData = {};

  filteredData.forEach(item => {
    totalNet += item.net; totalQty += item.qty;
    let dateKey = item.tgl_retur.includes('T') ? item.tgl_retur.split('T')[0] : item.tgl_retur;
    if(!trendData[dateKey]) trendData[dateKey] = { net: 0, qty: 0 };
    trendData[dateKey].net += item.net;
    trendData[dateKey].qty += item.qty;
  });

  document.getElementById('kpiNet').innerText = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalNet);
  document.getElementById('kpiQty').innerText = new Intl.NumberFormat('id-ID').format(totalQty);
  document.getElementById('kpiTx').innerText = new Intl.NumberFormat('id-ID').format(filteredData.length);

  const sortedDates = Object.keys(trendData).sort();
  renderTrendChart(sortedDates, sortedDates.map(d => trendData[d].net), sortedDates.map(d => trendData[d].qty));
}

// Chart.js Rendering
function renderTrendChart(labels, dataNet, dataQty) {
  const ctx = document.getElementById('trendChart').getContext('2d');
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
