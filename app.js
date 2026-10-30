(function () {
  'use strict';
  
  // ==========================================
  // GANTI DENGAN URL WEB APP GAS ANDA
  const GAS_API_URL = 'https://script.google.com/macros/s/XXXXXX/exec'; 
  // ==========================================

  var TOKEN_KEY = 'jhg_token';
  var $ = function (id) { return document.getElementById(id); };
  
  // Ambil parameter kelas dari URL (untuk QR Code)
  const urlParams = new URLSearchParams(window.location.search);
  var urlKelas = urlParams.get('kelas') || '';
  
  var state = { token: null, user: null, config: {}, masterData: null, targetKelas: urlKelas };

  // Fungsi Fetch API ke GAS
  async function callApi(action, token, data = {}) {
    try {
      const response = await fetch(GAS_API_URL, {
        method: 'POST',
        // text/plain menghindari preflight OPTIONS request yang sering diblokir CORS GAS
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: token, data: data })
      });
      
      const result = await response.json();
      if (result.ok === false) throw new Error(result.error || 'Gagal.');
      return result.data;
    } catch (error) {
      throw new Error(error.message || 'Kesalahan jaringan.');
    }
  }

  // Sisa logika window.navigateTo, show(), renderDashboard(), initFormJurnal(), dll.
  // SAMA PERSIS dengan kode Scripts.html Anda.
  // CUKUP UBAH SEMUA PEMANGGILAN callApi('namaFungsi', args) MENJADI callApi('namaFungsi', token, data)
  
  // CONTOH PERUBAHAN:
  // YANG LAMA: callApi('api_login', namaGuru, pin)
  // YANG BARU: callApi('api_login', null, { namaGuru: namaGuru, pin: pin })

  // YANG LAMA: callApi('api_getFormMasterData', state.token)
  // YANG BARU: callApi('api_getFormMasterData', state.token)

  // Karena kode JS Anda cukup panjang, silakan copy-paste logika aslinya dan sesuaikan pemanggilan callApi-nya.

  // ==========================================
  // CONTOH PENYESUAIAN FUNGSI BOOT
  // ==========================================
  function boot() {
    state.token = localStorage.getItem(TOKEN_KEY);
    
    // Load config awal via API atau hardcode
    $('schoolName').textContent = 'SMK Muhammadiyah 1 Surakarta';

    if (!state.token) { show('view-login'); loadTeachers(); return; }
    
    callApi('api_getCurrentUser', state.token).then(function (data) { 
      state.user = data.user; 
      state.config = data.config || state.config; 
      renderDashboard(data.user); 
    }).catch(function () { 
      localStorage.removeItem(TOKEN_KEY); 
      state.token = null; 
      show('view-login'); 
      loadTeachers(); 
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
