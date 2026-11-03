(function () {
  'use strict';
  
  // GANTI DENGAN URL WEB APP GAS ANDA
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyR93WUooPuW468-Rto5AMne17uvXw5XjzECPB5J1_4xrOjHTAVMr5AfFLSExnEX3F8/exec'; 

  var TOKEN_KEY = 'jhg_token';
  var $ = function (id) { return document.getElementById(id); };
  const urlParams = new URLSearchParams(window.location.search);
  var urlKelas = urlParams.get('kelas') || '';
  var state = { token: null, user: null, config: {}, masterData: null, targetKelas: urlKelas };

  async function callApi(action, token, data = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      const response = await fetch(GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: token, data: data }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const result = await response.json();
      
      if (result.ok === false && (result.error.includes('Sesi tidak valid') || result.error.includes('AUTH_REQUIRED'))) {
        localStorage.removeItem(TOKEN_KEY);
        state.token = null; state.user = null;
        show('view-login');
        throw new Error('Sesi berakhir, silakan login ulang.'); 
      }
      if (result.ok === false) throw new Error(result.error || 'Gagal.');
      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Koneksi ke server Google terlalu lama (Timeout).');
      throw new Error(error.message || 'Kesalahan jaringan.');
    }
  }

  window.navigateTo = function(page) {
    var tpl = document.getElementById('tpl-' + page) || document.getElementById('tpl-dashboard');
    $('main-content').innerHTML = tpl.innerHTML;
    
    if (page === 'dashboard' && state.user) {
      let h4 = document.querySelector('#main-content h4');
      let h2 = document.getElementById('dashNamaGuru');
      let pRole = document.getElementById('dashRole');
      
      if (h4) {
        let bannerTitle = "Selamat Datang,";
        if (state.targetKelas) {
          let match = state.masterData ? state.masterData.classes.find(c => c.class_id === state.targetKelas) : null;
          let namaKelas = match ? match.nama_kelas : state.targetKelas;
          bannerTitle = "Selamat Datang di Kelas " + namaKelas;
        }
        h4.textContent = bannerTitle;
      }
      if (h2) h2.textContent = state.user.nama_guru;
      if (pRole) pRole.textContent = "Peran: " + state.user.roles.join(', ').toUpperCase();

      let btnLogout = document.getElementById('btn-logout');
      if (btnLogout) {
        btnLogout.onclick = function() {
          if (!confirm('Keluar dari aplikasi?')) return;
          var t = state.token; state.token = null; state.user = null;
          localStorage.removeItem(TOKEN_KEY); 
          if ($('menu-laporan')) $('menu-laporan').classList.add('d-none');
          if ($('menu-admin')) $('menu-admin').classList.add('d-none');
          show('view-login');
          if (t) callApi('api_logout', t).catch(function () {});
        };
      }
      var hasWali = state.user.roles.indexOf('wali_kelas') !== -1;
      var hasAdmin = state.user.roles.indexOf('admin') !== -1;
      var hasKuri = state.user.roles.indexOf('kurikulum') !== -1;
      let btnSidebar = document.getElementById('btn-sidebar');
      if (hasWali || hasAdmin || hasKuri) {
        if (btnSidebar) btnSidebar.classList.remove('d-none');
        if ($('menu-laporan')) $('menu-laporan').classList.remove('d-none');
        if (hasAdmin && $('menu-admin')) $('menu-admin').classList.remove('d-none');
      } else {
        if (btnSidebar) btnSidebar.classList.add('d-none');
        if ($('menu-laporan')) $('menu-laporan').classList.add('d-none');
        if ($('menu-admin')) $('menu-admin').classList.add('d-none');
      }
    }
    if (page === 'form-jurnal') { setTimeout(initFormJurnal, 100); }
    if (page === 'admin') { setTimeout(initAdminPanel, 100); }
    if (page === 'laporan') { setTimeout(initReports, 100); }
    if (page === 'riwayat') { setTimeout(initRiwayat, 100); }
  };

  window.closeSidebar = function() {
    var sidebarEl = document.getElementById('sidebarMenu');
    if(sidebarEl) {
      var sidebar = bootstrap.Offcanvas.getInstance(sidebarEl);
      if (sidebar) sidebar.hide();
    }
  };

  function show(view) {
    ['view-loading', 'view-login', 'view-dashboard'].forEach(function (id) { 
      var el = $(id); if(el) el.classList.toggle('active', id === view); 
    });
    if (view === 'view-login') {
      if ($('btn-login')) { $('btn-login').disabled = false; $('btn-login').textContent = 'Masuk Aplikasi'; }
      if ($('login-message')) $('login-message').innerHTML = '';
      if ($('pin')) $('pin').value = '';
    }
  }

  function renderDashboard(user) {
    show('view-dashboard');
    if (state.targetKelas) { navigateTo('form-jurnal'); } else { navigateTo('dashboard'); }
  }

  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'form-login') {
      e.preventDefault();
      var emailGuru = $('emailGuru').value.trim();
      var pin = $('pin').value.trim();
      if (!emailGuru || !pin) return;

      $('btn-login').disabled = true; $('btn-login').textContent = 'Memproses...';
      callApi('api_login', null, { emailGuru: emailGuru, pin: pin }).then(function (data) {
        state.token = data.token; state.user = data.user;
        localStorage.setItem(TOKEN_KEY, data.token);
        $('pin').value = ''; renderDashboard(data.user);
      }).catch(function (err) { 
        $('login-message').innerHTML = '<span class="text-danger">'+err.message+'</span>'; 
        $('btn-login').disabled = false; $('btn-login').textContent = 'Masuk Aplikasi';
      });
    }
  });

  function initFormJurnal() {
    var today = new Date(); 
    if($('jTanggal')) $('jTanggal').value = today.toISOString().split('T')[0];
    if($('jNamaPengisi')) $('jNamaPengisi').value = state.user.nama_guru;
    
    var isPiket = state.user.roles.indexOf('piket') !== -1 || state.user.roles.indexOf('admin') !== -1;
    if (isPiket && $('optPengganti')) { $('optPengganti').style.display = 'block'; } 
    else {
      if ($('optPengganti')) $('optPengganti').style.display = 'none';
      if ($('jStatusGuru')) $('jStatusGuru').value = 'utama';
    }

    if (!state.targetKelas) {
      alert("⚠️ Anda tidak membuka aplikasi dari QR Code kelas.\n\nSilakan scan QR Code di pintu kelas untuk mengisi jurnal.");
      navigateTo('dashboard'); return;
    }
    if($('jMapel')) $('jMapel').innerHTML = '<option value="">Memuat data...</option>';

    callApi('api_getFormMasterData', state.token).then(function (data) {
      state.masterData = data;
      let kelas = data.classes.find(c => String(c.class_id).trim() === String(state.targetKelas).trim());
      if (kelas) {
        if($('jNamaKelas')) $('jNamaKelas').value = kelas.nama_kelas;
        if($('jKelas')) $('jKelas').value = kelas.class_id; 
        if($('jSiswa')) $('jSiswa').value = kelas.jumlah_siswa || 36;
        if(window.hitungHadir) window.hitungHadir();
      } else {
        if($('jNamaKelas')) $('jNamaKelas').value = "Kelas tidak ditemukan: " + state.targetKelas;
      }
      var selMapel = $('jMapel'); 
      if(selMapel){
        selMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
        if (data.subjects && data.subjects.length > 0) {
          data.subjects.forEach(s => { selMapel.innerHTML += `<option value="${s.subject_id}">${s.nama_mata_pelajaran}</option>`; });
        }
      }
      var selGuru = $('jGuruUtama'); 
      if(selGuru){
        selGuru.innerHTML = '<option value="">-- Pilih Guru --</option>';
        data.teachers.forEach(t => { if (t.user_id !== state.user.user_id) selGuru.innerHTML += `<option value="${t.user_id}">${t.nama_guru}</option>`; });
      }
    }).catch(function (err) { alert("Gagal memuat data dari server: " + err.message); });
  }

  window.toggleGuruPengganti = function() {
    if($('boxGuruPengganti') && $('jStatusGuru')) {
      $('boxGuruPengganti').classList.toggle('d-none', $('jStatusGuru').value !== 'pengganti');
    }
  };

  window.hitungHadir = function() {
    if(!$('jSiswa')) return;
    var total = parseInt($('jSiswa').value) || 0, sakit = parseInt($('jSakit').value) || 0;
    var izin = parseInt($('jIzin').value) || 0, alpa = parseInt($('jAlpa').value) || 0;
    var hadir = total - (sakit + izin + alpa); 
    $('jHadir').value = hadir < 0 ? 0 : hadir;
  };

  document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'formJurnal') {
      e.preventDefault();
      var btn = $('btnSimpan'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      var payload = {
        tanggal: $('jTanggal').value, status_guru: $('jStatusGuru').value, guru_utama_id: $('jGuruUtama').value,
        class_id: $('jKelas').value, subject_id: $('jMapel').value, jam_mulai: $('jJamMulai').value,
        jam_selesai: $('jJamSelesai').value, topik: $('jTopik').value, jumlah_siswa: $('jSiswa').value,
        jumlah_sakit: $('jSakit').value, jumlah_izin: $('jIzin').value, jumlah_alpa: $('jAlpa').value,
        kejadian: $('jKejadian').value
      };
      callApi('api_saveJournal', state.token, payload).then(function (res) {
        alert('✅ ' + res.message); 
        if(state.targetKelas) { initFormJurnal(); btn.disabled = false; btn.textContent = 'Simpan Jurnal'; } 
        else { navigateTo('dashboard'); }
      }).catch(function (err) {
        alert('❌ ' + err.message); btn.disabled = false; btn.textContent = 'Simpan Jurnal';
      });
    }
  });

  function initAdminPanel() {
    let tbGuru = $('tbody-guru'); 
    if (!tbGuru) return;
    callApi('api_getAdminData', state.token).then(data => {
      tbGuru.innerHTML = data.users.map(u => `<tr><td>${u.nama_guru}</td><td>${u.email}</td><td><span class="badge bg-secondary">${u.role}</span></td><td>${String(u.status_aktif).toLowerCase() === 'true' ? '<span class="text-success">Aktif</span>' : '<span class="text-danger">Nonaktif</span>'}</td><td><button type="button" class="btn btn-sm btn-primary" disabled>Edit</button></td></tr>`).join('');
      let tbKelas = $('tbody-kelas'); 
      if(tbKelas) tbKelas.innerHTML = data.classes.map(c => `<tr><td>${c.nama_kelas}</td><td>${c.tingkat}</td><td>${c.konsentrasi_keahlian}</td><td>${c.jumlah_siswa}</td><td><button type="button" class="btn btn-sm btn-primary" disabled>Edit</button></td></tr>`).join('');
      let tbMapel = $('tbody-mapel'); 
      if(tbMapel) tbMapel.innerHTML = data.subjects.map(s => `<tr><td>${s.nama_mata_pelajaran}</td><td>${String(s.status_aktif).toLowerCase() === 'true' ? 'Aktif' : 'Nonaktif'}</td><td><button type="button" class="btn btn-sm btn-primary" disabled>Edit</button></td></tr>`).join('');
    }).catch(err => alert("Error Admin: " + err.message));
  }

  function initReports() {
    if (!$('repTglMulai')) return;
    let today = new Date(); let firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    $('repTglMulai').value = firstDay.toISOString().split('T')[0];
    $('repTglSelesai').value = today.toISOString().split('T')[0];
    if($('tglCetak')) $('tglCetak').textContent = today.toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

    let sel = $('repKelas'); if(sel) sel.innerHTML = '<option value="">Memuat kelas...</option>';
    callApi('api_getFormMasterData', state.token).then(data => {
      if(!sel) return; sel.innerHTML = '<option value="">Semua Kelas</option>';
      if (data && data.classes && data.classes.length > 0) {
        data.classes.forEach(c => { sel.innerHTML += `<option value="${c.class_id}">${c.nama_kelas}</option>`; });
      } else { sel.innerHTML = '<option value="">(Data Kelas Kosong di Database)</option>'; }
    }).catch(err => { if(sel) sel.innerHTML = '<option value="">Gagal memuat</option>'; });
  }

  window.loadReports = function() {
    let filter = { tgl_mulai: $('repTglMulai').value, tgl_selesai: $('repTglSelesai').value, class_id: $('repKelas').value };
    let tb = $('tbody-reports'); if(!tb) return;
    tb.innerHTML = '<tr><td colspan="12" class="text-center">Memuat data...</td></tr>';
    callApi('api_getReports', state.token, filter).then(res => {
      tb.innerHTML = '';
      if (res.data.length === 0) { tb.innerHTML = '<tr><td colspan="12" class="text-center">Tidak ada data pada periode ini.</td></tr>'; return; }
      res.data.forEach((j, idx) => {
        let guruTxt = j.guru; if (j.guru_utama) guruTxt += ` <br><small class="text-danger">(Pengganti dari ${j.guru_utama})</small>`;
        let ket = (j.kejadian && j.kejadian !== '-') ? j.kejadian : '';
        tb.innerHTML += `<tr><td class="text-center">${idx+1}</td><td class="text-center">${j.tanggal}</td><td class="text-center">${j.nama_kelas}</td><td class="text-center">${j.jam}</td><td>${j.mapel}</td><td>${guruTxt}</td><td>${j.topik}</td><td class="text-center">${j.hadir}</td><td class="text-center">${j.sakit}</td><td class="text-center">${j.izin}</td><td class="text-center">${j.alpa}</td><td>${ket}</td></tr>`;
      });
    }).catch(err => alert("Error Laporan: " + err.message));
  }

  function initRiwayat() {
    let tb = $('tbody-riwayat');
    if (!tb) return;
    callApi('api_getMyJournals', state.token).then(res => {
      tb.innerHTML = '';
      if (!res.data || res.data.length === 0) {
        tb.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Belum ada jurnal yang pernah Anda isi.</td></tr>';
        return;
      }
      res.data.forEach(j => {
        let statusBadge = j.status === 'pengganti' ? `<span class="badge bg-warning text-dark">Pengganti (dari ${j.guru_utama})</span>` : `<span class="badge bg-success">Guru Utama</span>`;
        tb.innerHTML += `<tr><td>${j.tanggal}</td><td class="fw-bold">${j.nama_kelas}</td><td>${j.jam}</td><td>${j.mapel}</td><td>${j.topik}</td><td class="text-center"><span class="text-success">${j.hadir}</span> / <span class="text-warning">${j.sakit}</span> / <span class="text-info">${j.izin}</span> / <span class="text-danger">${j.alpa}</span></td><td>${statusBadge}</td></tr>`;
      });
    }).catch(err => {
      tb.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Gagal memuat riwayat: ${err.message}</td></tr>`;
    });
  }

  function boot() {
    var urlParams = new URLSearchParams(window.location.search);
    var urlToken = urlParams.get('token'); 
    
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      state.token = urlToken;
      window.history.replaceState({}, document.title, window.location.pathname + (state.targetKelas ? '?kelas=' + state.targetKelas : ''));
    } else {
      state.token = localStorage.getItem(TOKEN_KEY);
    }
    
    if($('schoolName')) $('schoolName').textContent = 'SMK Muhammadiyah 1 Surakarta';
    
    if (!state.token) { 
      show('view-login'); 
      if (state.targetKelas && $('warning-box')) {
        $('warning-box').classList.remove('d-none');
        $('warning-text').innerHTML = "🔒 Area Terbatas.<br>Silakan login dengan Email terdaftar untuk mengisi jurnal kelas <b>" + state.targetKelas + "</b>.";
      }
      return; 
    }
    
    callApi('api_getCurrentUser', state.token).then(function (data) { 
      state.user = data.user; 
      state.config = data.config || state.config; 
      renderDashboard(data.user); 
    }).catch(function (err) { 
      localStorage.removeItem(TOKEN_KEY); 
      state.token = null; 
      show('view-login'); 
      if (state.targetKelas && $('warning-box')) {
        $('warning-box').classList.remove('d-none');
        $('warning-text').innerHTML = "🔒 Area Terbatas.<br>Silakan login dengan Email terdaftar untuk mengisi jurnal kelas <b>" + state.targetKelas + "</b>.";
      }
    });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
