const API_URL = "https://script.google.com/macros/s/AKfycbzujly75H_753-WoJ9ToJsW72HK9OOWXU6SYlB2WiHbXsc1_uCuzg0TDyIFgJb6f-SN/exec";

document.addEventListener("DOMContentLoaded", () => {
    fetchDataDariGoogleSheet();
});

async function fetchDataDariGoogleSheet() {
    try {
        // Proses fetch
        const response = await fetch(API_URL);
        
        // Memastikan server Google merespon dengan baik
        if (!response.ok) {
            throw new Error(`Gagal mengambil data. Status Server: ${response.status}`);
        }
        
        const rawData = await response.json();
        
        if(rawData.error) {
            throw new Error(rawData.error); // Menangkap error dari kode.gs
        }
        
        // Jika sukses, matikan loader dan jalankan proses
        document.getElementById('loader').style.display = 'none';
        processAndRenderData(rawData); 
        
    } catch (error) {
        console.error("Detail Error:", error);
        
        // Ubah tampilan loader menjadi pesan error agar Anda tahu masalahnya
        document.getElementById('loader').innerHTML = `
            <div class="text-danger text-center mt-5">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <h4 class="fw-bold">Gagal Terhubung ke Database</h4>
                <p>${error.message}</p>
                <small class="text-muted">Cek Console (F12) untuk detail lebih lanjut.</small>
            </div>
        `;
    }
}
