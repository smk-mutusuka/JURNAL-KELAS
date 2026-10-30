(function () {
  'use strict';
  
  // =========================================================
  // PENTING: GANTI URL DI BAWAH INI DENGAN URL WEB APP GAS ANDA
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyR93WUooPuW468-Rto5AMne17uvXw5XjzECPB5J1_4xrOjHTAVMr5AfFLSExnEX3F8/exec'; 
  // =========================================================

  var TOKEN_KEY = 'jhg_token';
  var $ = function (id) { return document.getElementById(id); };
  
  // Ambil parameter kelas dari URL (untuk QR Code)
  const urlParams = new URLSearchParams(window.location.search);
  var urlKelas = urlParams.get('kelas') || '';
  
  var state = { token: null, user: null, config: {}, masterData: null, targetKelas: urlKelas };

  // --- FUNGSI FETCH API (PENGGANTI google.script.run) ---
  async function callApi(action, token, data = {}) {
    try {
      const response = await fetch(GAS_API_URL, {
        method: 'POST',
        // text/plain digunakan agar tidak memicu preflight request (CORS) di GAS
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

  // --- NAVIGASI & TAMPILAN ---
  window.navigateTo = function(page) {
    var tplId = 'tpl-' + page;
    var tpl = document.getElementById(tplId);
    if (!tpl) tpl = document.getElementById('tpl-dashboard');
    
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
    navigateTo('dashboard');
  }

  // --- AUTHENTICATION ---
  function loadTeachers() {
    callApi('api_getTeachers').then(function (teachers) {
      var select = $('namaGuru');
      if(!select) return;
      select.innerHTML = '<option value="">-- Pilih Nama Anda --</option>';
      teachers.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t.nama_guru; opt.textContent = t.nama_guru;
        select.appendChild(opt);
      });
    }).catch(function (err) { console.error('Gagal load guru:', err); });
  }

  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'form-login') {
      e.preventDefault();
      var namaGuru = $('namaGuru').value;
      var pin = $('pin').value.trim();
      if (!namaGuru || !pin) return;

      $('btn-login').disabled = true; $('btn-login').textContent = 'Memproses...';
      
      callApi('api_login', null, { namaGuru: namaGuru, pin: pin }).then(function (data) {
        state.token = data.token; 
        state.user = data.user;
        localStorage.setItem(TOKEN_KEY, data.token);
        $('pin').value = ''; 
        renderDashboard(data.user);
      }).catch(function (err) { 
        $('login-message').innerHTML = '<span class="text-danger">'+err.message+'</span>'; 
        $('btn-login').disabled = false; $('btn-login').textContent = 'Masuk Aplikasi';
      });
    }
  });

  // --- FORM JURNAL ---
  function initFormJurnal() {
    var today = new Date(); 
    if($('jTanggal')) $('jTanggal').value = today.toISOString().split('T')[0];
    
    var isPiket = state.user.roles.indexOf('piket') !== -1 || state.user.roles.indexOf('admin') !== -1;
    if (isPiket && $('optPengganti')) { $('optPengganti').style.display = 'block'; }

    if (!state.targetKelas) {
      alert("⚠️ Anda tidak membuka aplikasi dari QR Code kelas.\n\nSilakan scan QR Code di pintu kelas untuk mengisi jurnal.");
      navigateTo('dashboard');
      return;
    }

    if($('jMapel')) $('jMapel').innerHTML = '<option value="">Memuat data...</option>';

    callApi('api_getFormMasterData', state.token).then(function (data) {
      state.masterData = data;
      
      let kelas = data.classes.find(c => String(c.class_id).trim() === String(state.targetKelas).trim());
      if (kelas) {
        if($('jNamaKelas')) $('jNamaKelas').value = kelas.nama_kelas;
        if($('jKelas')) $('jKelas').value = kelas.class_id; 
      } else {
        if($('jNamaKelas')) $('jNamaKelas').value = "Kelas tidak ditemukan di database: " + state.targetKelas;
      }

      var selMapel = $('jMapel'); 
      if(selMapel){
        selMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
        if (data.subjects && data.subjects.length > 0) {
          data.subjects.forEach(s => { 
            selMapel.innerHTML += `<option value="${s.subject_id}">${s.nama_mata_pelajaran}</option>`; 
          });
        } else {
          selMapel.innerHTML = '<option value="">(Data Mapel Kosong di Sheet Subjects)</option>';
        }
      }
      
      var selGuru = $('jGuruUtama'); 
      if(selGuru){
        selGuru.innerHTML = '<option value="">-- Pilih Guru --</option>';
        data.teachers.forEach(t => { 
          if (t.user_id !== state.user.user_id) selGuru.innerHTML += `<option value="${t.user_id}">${t.nama_guru}</option>`; 
        });
      }
    }).catch(function (err) { 
      console.error(err);
      alert("Gagal memuat data dari server: " + err.message); 
    });
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
      var btn = $('btnSimpan'); 
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      
      var payload = {
        tanggal: $('jTanggal').value, status_guru: $('jStatusGuru').value, guru_utama_id: $('jGuruUtama').value,
        class_id: $('jKelas').value, subject_id: $('jMapel').value, jam_mulai: $('jJamMulai').value,
        jam_selesai: $('jJamSelesai').value, topik: $('jTopik').value, jumlah_siswa: $('jSiswa').value,
        jumlah_sakit: $('jSakit').value, jumlah_izin: $('jIzin').value, jumlah_alpa: $('jAlpa').value,
        kejadian: $('jKejadian').value
      };
      
      callApi('api_saveJournal', state.token, payload).then(function (res) {
        alert('✅ ' + res.message); 
        navigateTo('dashboard');
      }).catch(function (err) {
        alert('❌ ' + err.message); 
        btn.disabled = false; btn.textContent = 'Simpan Jurnal';
      });
    }
  });

  // --- ADMIN PANEL ---
  function initAdminPanel() {
    let tbGuru = $('tbody-guru'); 
    if (!tbGuru) return;

    callApi('api_getAdminData', state.token).then(data => {
      // Render GURU
      tbGuru.innerHTML = '';
      if (!data.users || data.users.length === 0) {
        tbGuru.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Data Guru Kosong.</td></tr>';
      } else {
        data.users.forEach(u => {
          let isAktif = String(u.status_aktif).toLowerCase() === 'true';
          tbGuru.innerHTML += `<tr>
            <td>${u.nama_guru}</td><td>${u.email}</td><td><span class="badge bg-secondary">${u.role}</span></td>
            <td>${isAktif ? '<span class="text-success">Aktif</span>' : '<span class="text-danger">Nonaktif</span>'}</td>
            <td><button type="button" class="btn btn-sm btn-primary" disabled>Edit</button></td>
          </tr>`;
        });
      }
      
      // Render KELAS
      let tbKelas = $('tbody-kelas'); 
      if(tbKelas) {
        tbKelas.innerHTML = '';
        if (!data.classes || data.classes.length === 0) {
          tbKelas.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Data Kelas Kosong.</td></tr>';
        } else {
          data.classes.forEach(c => {
            tbKelas.innerHTML += `<tr>
              <td>${c.nama_kelas}</td><td>${c.tingkat}</td><td>${c.konsentrasi_keahlian}</td><td>${c.jumlah_siswa}</td>
              <td><button type="button" class="btn btn-sm btn-primary" disabled>Edit</button></td>
            </tr>`;
          });
        }
      }
      
      // Render MAPEL
      let tbMapel = $('tbody-mapel'); 
      if(tbMapel) {
        tbMapel.innerHTML = '';
        if (!data.subjects || data.subjects.length === 0) {
          tbMapel.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Data Mapel Kosong.</td></tr>';
        } else {
          data.subjects.forEach(s => {
            let isAktif = String(s.status_aktif).toLowerCase() === 'true';
            tbMapel.innerHTML += `<tr>
              <td>${s.nama_mata_pelajaran}</td><td>${isAktif ? 'Aktif' : 'Nonaktif'}</td>
              <td><button type="button" class="btn btn-sm btn-primary" disabled>Edit</button></td>
            </tr>`;
          });
        }
      }
    }).catch(err => alert("Error Admin: " + err.message));
  }

  // --- REPORTS ---
  function initReports() {
    if (!$('repTglMulai')) return;

    let today = new Date();
    let firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    $('repTglMulai').value = firstDay.toISOString().split('T')[0];
    $('repTglSelesai').value = today.toISOString().split('T')[0];
    
    if($('tglCetak')) {
      $('tglCetak').textContent = today.toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});
    }

    callApi('api_getFormMasterData', state.token).then(data => {
      let sel = $('repKelas'); 
      if(!sel) return;
      sel.innerHTML = '<option value="">Semua Kelas</option>';
      
      if (data && data.classes && data.classes.length > 0) {
        data.classes.forEach(c => { sel.innerHTML += `<option value="${c.class_id}">${c.nama_kelas}</option>`; });
      } else {
        sel.innerHTML = '<option value="">(Data Kelas Kosong)</option>';
      }
    }).catch(err => console.error("Error Load Filter Kelas:", err));
  }

  window.loadReports = function() {
    let filter = {
      tgl_mulai: $('repTglMulai').value,
      tgl_selesai: $('repTglSelesai').value,
      class_id: $('repKelas').value
    };
    
    let tb = $('tbody-reports'); 
    if(!tb) return;
    tb.innerHTML = '<tr><td colspan="12" class="text-center">Memuat data...</td></tr>';
    
    callApi('api_getReports', state.token, filter).then(res => {
      tb.innerHTML = '';
      if (res.data.length === 0) {
        tb.innerHTML = '<tr><td colspan="12" class="text-center">Tidak ada data pada periode ini.</td></tr>';
        return;
      }
      res.data.forEach((j, idx) => {
        let guruTxt = j.guru;
        if (j.guru_utama) guruTxt += ` <br><small class="text-danger">(Pengganti dari ${j.guru_utama})</small>`;
        
        let ket = (j.kejadian && j.kejadian !== '-') ? j.kejadian : '';

        tb.innerHTML += `<tr>
          <td class="text-center">${idx+1}</td>
          <td class="text-center">${j.tanggal}</td>
          <td class="text-center">${j.nama_kelas}</td>
          <td class="text-center">${j.jam}</td>
          <td>${j.mapel}</td>
          <td>${guruTxt}</td>
          <td>${j.topik}</td>
          <td class="text-center">${j.hadir}</td>
          <td class="text-center">${j.sakit}</td>
          <td class="text-center">${j.izin}</td>
          <td class="text-center">${j.alpa}</td>
          <td>${ket}</td>
        </tr>`;
      });
    }).catch(err => alert("Error Laporan: " + err.message));
  }

  // --- BOOT (INISIALISASI AWAL) ---
  function boot() {
    state.token = localStorage.getItem(TOKEN_KEY);
    
    // Set nama sekolah langsung
    if($('schoolName')) $('schoolName').textContent = 'SMK Muhammadiyah 1 Surakarta';
    
    if (!state.token) { 
      show('view-login'); 
      loadTeachers(); 
      return; 
    }
    
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
