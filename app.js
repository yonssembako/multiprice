/** 
 * Yons Agen Kasir — Frontend Script. 
 * Isi API_URL dengan URL Web App Apps Script setelah deployment. 
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbzD4q2SOtRUyW2ubydbwdQvrXd6EOdC5FEqRECErygh08dXj83lkTuSlMJQ7iSR94Tb/exec';

const $ = id => document.getElementById(id);

const state = {
  password: '',
  products: [],
  customers: [],
  suppliers: [],
  cart: [],
  purchaseCart: [],
  lastReceipt: null,
  dashboard: null,
  finance: { hutang: [], piutang: [] }
};

const rupiah = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function api(action, data = {}) {
  return new Promise((resolve, reject) => {
    if (!API_URL.startsWith('https://script.google.com/')) {
      return reject(new Error('URL Apps Script belum diisi di app.js.'));
    }
    
    const callback = 'yonsCb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi timeout. Periksa URL dan deployment Apps Script.'));
    }, 20000);
    
    function cleanup() {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
    }
    
    window[callback] = result => {
      cleanup();
      if (result && result.ok) resolve(result);
      else reject(new Error(result?.error || 'Permintaan gagal.'));
    };
    
    const params = new URLSearchParams({ action, callback, password: state.password, payload: JSON.stringify(data) });
    script.src = API_URL + '?' + params.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error('Gagal terhubung ke Apps Script.'));
    };
    
    document.body.appendChild(script);
  });
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  // Jangan mengubah password yang dimasukkan; cocokkan persis dengan Script Properties.
  state.password = $('password').value;
  const message = $('loginMessage');
  const submitButton = $('loginForm').querySelector('button[type="submit"]');
  submitButton.disabled = true;
  message.textContent = 'Memeriksa password…';

  try {
    await api('login');
    $('loginScreen').classList.add('hidden');
    $('app').classList.remove('hidden');
    message.textContent = '';

    // Kesalahan saat memuat data setelah login tidak membatalkan autentikasi.
    await Promise.allSettled([
      loadProducts(),
      loadCustomers(),
      loadSuppliers(),
      loadDashboard()
    ]);
  } catch (err) {
    state.password = '';
    $('password').value = '';
    message.textContent = (err && err.message ? err.message : String(err)) +
      ' Periksa KASIR_PASSWORD di Apps Script > Project Settings > Script properties, dan pastikan Web App sudah di-deploy ke versi terbaru.';
  } finally {
    submitButton.disabled = false;
  }
});
$('logoutBtn').onclick = () => {
  state.password = '';
  state.cart = [];
  $('app').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');$('password').focus();
};

document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('hidden', p.id !== 'page-' + b.dataset.page));
  
  if (b.dataset.page === 'kasir') renderCart();
  if (b.dataset.page === 'dashboard') loadDashboard();
  if (b.dataset.page === 'finance') loadFinance();
  if (b.dataset.page === 'pembelian') {
    loadSuppliers();
    fillPurchaseSelect();
    renderPurchaseCart();
  }
});

function updateHeaderClock() {
  const el = $('headerClock');
  if (!el) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  el.textContent = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}  ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
updateHeaderClock();
setInterval(updateHeaderClock, 1000);

$('refreshProducts').onclick = loadProducts;
if ($('productSearch')) $('productSearch').addEventListener('input', renderProducts);

async function loadProducts() {
  try {
    const r = await api('products');
    state.products = r.products || [];
    renderProducts();
    fillProductSelect();
  } catch (e) {
    $('productGrid').innerHTML = '<p class="muted">' + esc(e.message) + '</p>';
  }
}

function renderProducts() {
  if (!state.products.length) {
    $('productGrid').innerHTML = '<p class="muted">Belum ada data produk. Tambahkan produk di sheet Produk.</p>';
    return;
  }
  
  $('productGrid').innerHTML = state.products.map(p => {
    const name = String(p.nama || '').toLowerCase();
    const fallback = name.includes('telur') ? 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=600&q=80' : (name.includes('minyak') ? 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80' : (name.includes('beras') ? 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80' : 'https://placehold.co/600x400/eaf4f7/52666d?text=Foto+Produk'));
    const photo = p.foto || fallback;
    
    return `<article class="product-card"><img class="product-photo" src="${esc(photo)}" alt="Foto ${esc(p.nama)}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/600x400/eaf4f7/52666d?text=Foto+Produk'"><div class="product-info"><div class="product-title-row"><h3>${esc(p.nama)}</h3><span class="stock">Stok: ${esc(p.stok)} ${esc(p.satuan)}</span></div><p>${esc(p.kategori || 'Barang')} · ${esc(p.keterangan || 'Tidak ada keterangan')}</p><div class="price">${rupiah(p.harga)} / ${esc(p.satuan || 'unit')}</div></div></article>`;
  }).join('');
}

function fillProductSelect() {
  const old = $('itemSelect').value;
  $('itemSelect').innerHTML = '<option value="">Pilih barang…</option>' + state.products.filter(p => Number(p.stok) > 0).map(p => `<option value="${esc(p.id)}">${esc(p.nama)}</option>`).join('');
  if (state.products.some(p => p.id === old)) $('itemSelect').value = old;
  updateSelectedProduct();
  if ($('itemSearch')) $('itemSearch').value = state.products.find(p => p.id === old)?.nama || '';
}

function showProductSearchResults() {
  const input = $('itemSearch');
  const results = $('itemSearchResults');
  if (!input || !results) return;
  const q = input.value.trim().toLocaleLowerCase('id');
  $('itemSelect').value = '';
  updateSelectedProduct();
  if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
  if (!state.products.length) { results.innerHTML = '<div class="search-empty">Data barang belum termuat. Muat ulang aplikasi dan periksa koneksi.</div>'; results.classList.remove('hidden'); return; }
  const matches = state.products.filter(p => Number(p.stok) > 0 && String(p.nama || '').toLocaleLowerCase('id').includes(q)).slice(0, 30);
  results.innerHTML = matches.length ? matches.map(p => `<button type="button" class="search-result" data-product-id="${esc(p.id)}"><strong>${esc(p.nama)}</strong><small>Stok: ${esc(p.stok)} ${esc(p.satuan || '')} · ${rupiah(p.harga)}</small></button>`).join('') : '<div class="search-empty">Barang tidak ditemukan.</div>';
  results.classList.remove('hidden');
}

if ($('itemSearch')) {
  $('itemSearch').addEventListener('input', showProductSearchResults);
  $('itemSearch').addEventListener('focus', showProductSearchResults);
  $('itemSearchResults').addEventListener('click', e => {
    const button = e.target.closest('[data-product-id]');
    if (!button) return;
    const p = state.products.find(x => String(x.id) === button.dataset.productId);
    if (!p) return;
    $('itemSelect').value = String(p.id);
    $('itemSearch').value = p.nama;
    $('itemSearchResults').classList.add('hidden');
    updateSelectedProduct();
    $('itemQty').focus();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.product-search-wrap')) $('itemSearchResults').classList.add('hidden');
  });
}

$('itemSelect').onchange = () => {
  updateSelectedProduct();
  if ($('itemSelect').value) $('itemQty').focus();
};

function priceForQty(p, qty) {
  if (!p) return 0;
  const tiers = (p.hargaMulti || []).filter(t => Number(qty) >= Number(t.min) && (!t.max || Number(qty) <= Number(t.max))).sort((a, b) => Number(b.min) - Number(a.min));
  return tiers.length ? Number(tiers[0].price) : Number(p.harga) || 0;
}
function updateSelectedProduct() {
  const p = state.products.find(x => x.id === $('itemSelect').value);
  const qty = Number($('itemQty').value) || 1;
  $('itemPrice').value = p ? rupiah(priceForQty(p, qty)) + ' / ' + (p.satuan || 'unit') : '';
  $('itemStock').value = p ? `${p.stok} ${p.satuan || ''}` : '';
}
if ($('itemQty')) $('itemQty').addEventListener('input', updateSelectedProduct);

$('addItem').onclick = () => {
  const p = state.products.find(x => x.id === $('itemSelect').value);
  const qty = Number($('itemQty').value);
  
  if (!p) return alert('Pilih barang terlebih dahulu.');
  if (!(qty > 0)) return alert('Qty harus lebih dari 0.');
  
  const inCart = state.cart.filter(x => x.id === p.id).reduce((s, x) => s + x.qty, 0);
  if (qty + inCart > Number(p.stok)) return alert('Qty melebihi stok yang tersedia.');
  
  const existing = state.cart.find(x => x.id === p.id);
  if (existing) {
    existing.qty += qty;
    existing.harga = priceForQty(p, existing.qty);
  } else {
    state.cart.push({ id: p.id, nama: p.nama, satuan: p.satuan || 'unit', harga: priceForQty(p, qty), qty });
  }
  
  $('itemQty').value = '';
  $('itemSearch').value = '';
  $('itemSelect').value = '';
  $('itemSearchResults').classList.add('hidden');
  updateSelectedProduct();
  renderCart();
};

function renderCart() {
  const body = $('cartRows');
  if (!state.cart.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Belum ada barang.</td></tr>';
  } else {
    body.innerHTML = state.cart.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.nama)}</td><td>${x.qty} ${esc(x.satuan)}</td><td>${rupiah(x.harga)}</td><td>${rupiah(x.qty * x.harga)}</td><td><button data-remove="${i}" title="Hapus">×</button></td></tr>`).join('');
  }
  
  body.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
    state.cart.splice(Number(b.dataset.remove), 1);
    renderCart();
  });
  
  $('cartTotal').textContent = rupiah(cartTotal());
  updateChange();
}

const cartTotal = () => state.cart.reduce((s, x) => s + x.qty * x.harga, 0);

$('amountPaid').oninput = updateChange;

function updateChange() {
  $('changeDue').textContent = rupiah(Math.max(0, Number($('amountPaid').value || 0) - cartTotal()));
}

$('finishSale').onclick = async () => {
  if (!state.cart.length) return alert('Daftar belanja masih kosong.');
  
  const total = cartTotal();
  const bayar = Number($('amountPaid').value || 0);
  const namaPelanggan = $('customerName').value.trim() || 'Pelanggan Umum';
  let cashbon = false;
  if (bayar < total) {
    if (namaPelanggan === 'Pelanggan Umum') {
      return alert('Pilih atau isi nama pelanggan terlebih dahulu agar piutang tercatat atas nama yang benar.');
    }
    const sisa = total - Math.max(0, bayar);
    cashbon = window.confirm(
      'Pembayaran belum lunas.\n\nTotal: ' + rupiah(total) +
      '\nDibayar: ' + rupiah(bayar) +
      '\nSisa piutang: ' + rupiah(sisa) +
      '\n\nTekan OK untuk proses sebagai cashbon dan catat piutang pelanggan. Tekan Cancel untuk membatalkan.'
    );
    if (!cashbon) return;
  }
  
  $('finishSale').disabled = true;
  $('saleMessage').textContent = 'Menyimpan transaksi…';
  
  try {
    const r = await api('checkout', {
      namaPelanggan,
      bayar, cashbon,
      items: state.cart
    });
    
    state.lastReceipt = r.receipt;
    showReceipt(r.receipt);
    
    state.cart = [];
    $('amountPaid').value = '';$('customerName').value = '';
    renderCart();
    
    await Promise.all([loadProducts(), loadCustomers(), loadSuppliers(), loadDashboard(), loadFinance()]);
    $('saleMessage').textContent = 'Transaksi berhasil disimpan.';
  } catch (e) {
    $('saleMessage').textContent = e.message;
  } finally {
    $('finishSale').disabled = false;
  }
};

async function loadSuppliers() {
  try {
    const r = await api('suppliers');
    state.suppliers = r.suppliers || [];
    // Data pemasok digunakan oleh kolom pencarian pemasok.
  } catch (e) {
    console.warn(e.message);
  }
}

function fillPurchaseSelect() {
  const old = $('purchaseItem').value;
  $('purchaseItem').innerHTML = '<option value="">Pilih barang…</option>' + state.products.map(p => `<option value="${esc(p.id)}">${esc(p.nama)}</option>`).join('');
  if (state.products.some(p => p.id === old)) $('purchaseItem').value = old;
  if ($('purchaseItemSearch')) $('purchaseItemSearch').value = state.products.find(p => p.id === old)?.nama || '';
}

function showPurchaseProductSearchResults() {
  const input = $('purchaseItemSearch');
  const results = $('purchaseItemSearchResults');
  if (!input || !results) return;
  const q = input.value.trim().toLocaleLowerCase('id');
  $('purchaseItem').value = '';
  $('purchasePrice').value = '';
  if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
  if (!state.products.length) { results.innerHTML = '<div class="search-empty">Data barang belum termuat. Muat ulang aplikasi dan periksa koneksi.</div>'; results.classList.remove('hidden'); return; }
  const matches = state.products.filter(p => String(p.nama || '').toLocaleLowerCase('id').includes(q)).slice(0, 30);
  results.innerHTML = matches.length ? matches.map(p => `<button type="button" class="search-result" data-purchase-product-id="${esc(p.id)}"><strong>${esc(p.nama)}</strong><small>Stok: ${esc(p.stok)} ${esc(p.satuan || '')} · Beli sebelumnya: ${p.hargaBeliSebelumnya == null ? 'Belum ada' : rupiah(p.hargaBeliSebelumnya)}</small></button>`).join('') : '<div class="search-empty">Barang tidak ditemukan.</div>';
  results.classList.remove('hidden');
}

if ($('purchaseItemSearch')) {
  $('purchaseItemSearch').addEventListener('input', showPurchaseProductSearchResults);
  $('purchaseItemSearch').addEventListener('focus', showPurchaseProductSearchResults);
  $('purchaseItemSearchResults').addEventListener('click', e => {
    const button = e.target.closest('[data-purchase-product-id]');
    if (!button) return;
    const p = state.products.find(x => String(x.id) === button.dataset.purchaseProductId);
    if (!p) return;
    $('purchaseItem').value = String(p.id);
    $('purchaseItemSearch').value = p.nama;
    $('purchaseItemSearchResults').classList.add('hidden');
    $('purchasePrice').value = p && p.hargaBeliSebelumnya != null ? Number(p.hargaBeliSebelumnya) : '';
    $('previousPurchasePrice').value = p && p.hargaBeliSebelumnya != null ? rupiah(p.hargaBeliSebelumnya) : 'Belum ada riwayat';
    $('purchaseQty').focus();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.purchase-product-search-wrap')) $('purchaseItemSearchResults').classList.add('hidden');
  });
}

$('purchaseItem').onchange = () => {
  const p = state.products.find(x => x.id === $('purchaseItem').value);
  $('purchasePrice').value = p && p.hargaBeliSebelumnya != null ? Number(p.hargaBeliSebelumnya) : '';
  $('previousPurchasePrice').value = p && p.hargaBeliSebelumnya != null ? rupiah(p.hargaBeliSebelumnya) : 'Belum ada riwayat';
};

$('addPurchaseItem').onclick = () => {
  const p = state.products.find(x => x.id === $('purchaseItem').value);
  const qty = Number($('purchaseQty').value);
  const hargaBeli = Number($('purchasePrice').value);
  
  if (!p) return alert('Pilih barang.');
  if (!(qty > 0) || !(hargaBeli >= 0) || $('purchasePrice').value === '') return alert('Isi jumlah dan harga beli dengan benar.');
  
  const existing = state.purchaseCart.find(x => x.id === p.id);
  if (existing) {
    existing.qty += qty;
    existing.hargaBeli = hargaBeli;
  } else {
    state.purchaseCart.push({ id: p.id, nama: p.nama, satuan: p.satuan || 'unit', qty, hargaBeli });
  }
  
  $('purchaseQty').value = '1';
  renderPurchaseCart();
};

function renderPurchaseCart() {
  const el = $('purchaseList');
  if (!state.purchaseCart.length) {
    el.innerHTML = '<p class="muted">Belum ada barang pembelian.</p>';
  } else {
    el.innerHTML = state.purchaseCart.map((x, i) => `<div class="purchase-row"><div><strong>${esc(x.nama)}</strong><small>${x.qty} ${esc(x.satuan)} × ${rupiah(x.hargaBeli)}</small></div><strong>${rupiah(x.qty * x.hargaBeli)}</strong><button type="button" data-premove="${i}" aria-label="Hapus barang">×</button></div>`).join('');
  }
  
  el.querySelectorAll('[data-premove]').forEach(b => b.onclick = () => {
    state.purchaseCart.splice(Number(b.dataset.premove), 1);
    renderPurchaseCart();
  });
  
  $('purchaseTotal').textContent = rupiah(state.purchaseCart.reduce((s, x) => s + x.qty * x.hargaBeli, 0));
}

$('savePurchase').onclick = async () => {
  if (!state.purchaseCart.length) return alert('Tambahkan barang pembelian terlebih dahulu.');
  if (!$('supplierName').value.trim()) return alert('Isi nama pemasok.');
  
  const btn = $('savePurchase');
  btn.disabled = true;
  $('purchaseMessage').textContent = 'Menyimpan pembelian…';
  
  try {
    const r = await api('purchase', {
      namaSupplier: $('supplierName').value.trim(),
      metodeBayar: $('purchaseMethod').value,
      catatan: $('purchaseNote').value.trim(),
      items: state.purchaseCart
    });
    
    state.purchaseCart = [];
    renderPurchaseCart();
    $('purchaseNote').value = '';$('purchaseMessage').textContent = `Pembelian ${r.purchase.id} tersimpan. Total ${rupiah(r.purchase.total)}. Stok sudah diperbarui.`;
    
    await Promise.all([loadProducts(), loadSuppliers(), loadDashboard()]);
  } catch (e) {
    $('purchaseMessage').textContent = e.message;
  } finally {
    btn.disabled = false;
  }
};

function showSupplierSearchResults() {
  const input = $('supplierName');
  const results = $('supplierSearchResults');
  if (!input || !results) return;
  const q = input.value.trim().toLocaleLowerCase('id');
  if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
  if (!state.suppliers.length) { results.innerHTML = '<div class="search-empty">Data pemasok belum termuat atau belum ada di data pemasok.</div>'; results.classList.remove('hidden'); return; }
  const matches = state.suppliers.filter(s => String(s.nama || '').toLocaleLowerCase('id').includes(q)).slice(0, 30);
  results.innerHTML = matches.length ? matches.map(s => `<button type="button" class="search-result" data-supplier-name="${esc(s.nama)}">${esc(s.nama)}</button>`).join('') : '<div class="search-empty">Pemasok tidak ditemukan.</div>';
  results.classList.remove('hidden');
}

$('supplierName').addEventListener('input', showSupplierSearchResults);
$('supplierName').addEventListener('focus', showSupplierSearchResults);
$('supplierSearchResults').addEventListener('click', e => {
  const button = e.target.closest('[data-supplier-name]');
  if (!button) return;
  $('supplierName').value = button.dataset.supplierName;
  $('supplierSearchResults').classList.add('hidden');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.supplier-field')) $('supplierSearchResults').classList.add('hidden');
});

$('addSupplierBtn').onclick = () => {
  $('supplierForm').classList.toggle('hidden');
  $('supplierMessage').textContent = '';
  if (!$('supplierForm').classList.contains('hidden')) $('newSupplierName').focus();
};
$('cancelSupplierBtn').onclick = () => {
  $('supplierForm').classList.add('hidden');
  $('newSupplierName').value = ''; $('newSupplierWa').value = ''; $('newSupplierAddress').value = '';
  $('supplierMessage').textContent = '';
};
$('saveSupplierBtn').onclick = async () => {
  const nama = $('newSupplierName').value.trim();
  if (!nama) { $('supplierMessage').textContent = 'Nama pemasok wajib diisi.'; return; }
  const btn = $('saveSupplierBtn'); btn.disabled = true;
  $('supplierMessage').textContent = 'Menyimpan pemasok…';
  try {
    const r = await api('addSupplier', { nama, wa: $('newSupplierWa').value.trim(), alamat: $('newSupplierAddress').value.trim() });
    await loadSuppliers();
    $('supplierName').value = r.supplier.nama;
    $('supplierForm').classList.add('hidden');
    $('newSupplierName').value = ''; $('newSupplierWa').value = ''; $('newSupplierAddress').value = '';
    $('supplierMessage').textContent = 'Pemasok berhasil disimpan.';
  } catch (e) { $('supplierMessage').textContent = e.message; }
  finally { btn.disabled = false; }
};

async function loadCustomers() {
  try {
    const r = await api('customers');
    state.customers = r.customers || [];
  } catch (e) {
    console.warn(e.message);
  }
}

function showCustomerSearchResults() {
  const input = $('customerName');
  const results = $('customerSearchResults');
  if (!input || !results) return;
  const q = input.value.trim().toLocaleLowerCase('id');
  if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
  if (!state.customers.length) { results.innerHTML = '<div class="search-empty">Data pelanggan belum termuat atau belum ada di data pelanggan.</div>'; results.classList.remove('hidden'); return; }
  const matches = state.customers.filter(c => String(c.nama || '').toLocaleLowerCase('id').includes(q)).slice(0, 30);
  results.innerHTML = matches.length ? matches.map(c => `<button type="button" class="search-result" data-customer-name="${esc(c.nama)}">${esc(c.nama)}</button>`).join('') : '<div class="search-empty">Pelanggan tidak ditemukan.</div>';
  results.classList.remove('hidden');
}

$('customerName').addEventListener('input', showCustomerSearchResults);
$('customerName').addEventListener('focus', showCustomerSearchResults);
$('customerSearchResults').addEventListener('click', e => {
  const button = e.target.closest('[data-customer-name]');
  if (!button) return;
  $('customerName').value = button.dataset.customerName;
  $('customerSearchResults').classList.add('hidden');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.customer-field')) $('customerSearchResults').classList.add('hidden');
});

$('addCustomerBtn').onclick = () => {
  $('customerForm').classList.toggle('hidden');$('customerMessage').textContent = '';
  if (!$('customerForm').classList.contains('hidden'))$('newCustomerName').focus();
};

$('cancelCustomerBtn').onclick = () => {$('customerForm').classList.add('hidden');
  $('newCustomerName').value = '';$('newCustomerWa').value = '';
  $('newCustomerAddress').value = '';$('customerMessage').textContent = '';
};

$('saveCustomerBtn').onclick = async () => {
  const nama = $('newCustomerName').value.trim();
  if (!nama) {
    $('customerMessage').textContent = 'Nama pelanggan wajib diisi.';
    return;
  }
  
  const btn = $('saveCustomerBtn');
  btn.disabled = true;
  $('customerMessage').textContent = 'Menyimpan data pelanggan…';
  
  try {
    const r = await api('addCustomer', {
      nama,
      wa: $('newCustomerWa').value.trim(),
      alamat: $('newCustomerAddress').value.trim()
    });
    
    await loadCustomers();
    $('customerName').value = r.customer.nama;
    $('customerSearchResults').classList.add('hidden');
    $('customerForm').classList.add('hidden');
    $('newCustomerName').value = '';$('newCustomerWa').value = '';
    $('newCustomerAddress').value = '';$('customerMessage').textContent = 'Pelanggan berhasil disimpan.';
  } catch (e) {
    $('customerMessage').textContent = e.message;
  } finally {
    btn.disabled = false;
  }
};


$('refreshFinance').onclick = loadFinance;

async function loadFinance() {
  try {
    const r = await api('finance');
    state.finance = { hutang: r.hutang || [], piutang: r.piutang || [] };
    renderFinanceTable('hutang', state.finance.hutang, 'financeHutang');
    renderFinanceTable('piutang', state.finance.piutang, 'financePiutang');
    $('financeMessage').textContent = '';
  } catch (e) {
    $('financeHutang').innerHTML = `<p class="muted">${esc(e.message)}</p>`;
    $('financePiutang').innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}
function renderFinanceTable(type, rows, targetId) {
  const el = $(targetId);
  if (!rows.length) { el.innerHTML = '<p class="muted">Belum ada data.</p>'; return; }
  el.innerHTML = `<table class="finance-table"><thead><tr><th>Tanggal</th><th>Nama</th><th>Jumlah</th><th>Jml pembayaran</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.tanggal)}</td><td>${esc(r.nama)}</td><td>${rupiah(r.total)}</td><td>${rupiah(r.dibayar)}</td><td>${rupiah(r.sisa)}</td><td>${esc(normalizeFinanceStatus(r.status, r.dibayar, r.sisa))}</td><td>${Number(r.sisa) > 0 ? `<button type="button" class="secondary" data-finance-type="${type}" data-finance-id="${esc(r.id)}" data-finance-remain="${Number(r.sisa)}">Bayar</button>` : '—'}</td></tr>`).join('')}</tbody></table>`;
  el.querySelectorAll('[data-finance-id]').forEach(btn => btn.onclick = async () => {
    const remain = Number(btn.dataset.financeRemain);
    const raw = prompt(`Masukkan pembayaran untuk ${btn.dataset.financeId}. Sisa tagihan ${rupiah(remain)}:`, String(remain));
    if (raw === null) return;
    const amount = Number(String(raw).replace(/[.,\s]/g, ''));
    if (!(amount > 0)) return alert('Jumlah pembayaran harus lebih dari 0.');
    btn.disabled = true;
    try {
      await api('financePayment', { type: btn.dataset.financeType, id: btn.dataset.financeId, amount });
      await loadFinance();
    } catch (e) { alert(e.message); btn.disabled = false; }
  });
}
function normalizeFinanceStatus(status, paid, remain) {
  if (Number(remain) <= 0) return 'Lunas';
  if (Number(paid) > 0) return 'Cicil';
  return 'Belum ada pembayaran';
}

function showReceipt(r) {
  $('receiptContent').innerHTML = `
    <div class="receipt-title">
      <h2>YONS AGEN</h2>
      <div>Jl. Parungseah RT.04/RW.06, Sukabumi</div>
      <div>HP 089614021972</div>
      <p>STRUK BELANJA</p>
    </div>
    <div class="receipt-line"><span>No. transaksi</span><strong>${esc(r.id)}</strong></div>
    <div class="receipt-line"><span>Tanggal</span><span>${esc(r.tanggal)}</span></div>
    <div class="receipt-line"><span>Pelanggan</span><span>${esc(r.pelanggan)}</span></div>
    <div class="receipt-items">${r.items.map(x => `<p>${esc(x.nama)}<br><small>${x.qty} ${esc(x.satuan)} ×${rupiah(x.harga)} <span style="float:right">${rupiah(x.jumlah)}</span></small></p>`).join('')}</div>
    <div class="receipt-line"><strong>Total</strong><strong>${rupiah(r.total)}</strong></div>
    <div class="receipt-line"><span>Bayar</span><span>${rupiah(r.bayar)}</span></div>
    <div class="receipt-line"><span>Kembalian</span><span>${rupiah(r.kembalian)}</span></div>
    ${Number(r.sisaPiutang) > 0 ? `<div class="receipt-line"><strong>Sisa piutang</strong><strong>${rupiah(r.sisaPiutang)}</strong></div>` : ''}
    <p style="text-align:center;margin-top:22px">Terima kasih telah berbelanja.</p>
  `;
  $('receiptModal').classList.remove('hidden');
}

$('closeReceipt').onclick = () =>$('receiptModal').classList.add('hidden');

$('receiptModal').addEventListener('click', e => {
  if (e.target === $('receiptModal'))$('receiptModal').classList.add('hidden');
});

function receiptText(r) {
  return `*YONS AGEN — STRUK BELANJA*\nJl. Parungseah RT.04/RW.06, Sukabumi\nNo: ${r.id}\nTanggal: ${r.tanggal}\nPelanggan: ${r.pelanggan}\n\n${r.items.map(x => `${x.nama}\n${x.qty}${x.satuan} x ${rupiah(x.harga)} =${rupiah(x.jumlah)}`).join('\n')}\n\n*TOTAL: ${rupiah(r.total)}*\nBayar: ${rupiah(r.bayar)}\nKembalian: ${rupiah(r.kembalian)}${Number(r.sisaPiutang) > 0 ? `\nSisa piutang: ${rupiah(r.sisaPiutang)}` : ''}\n\nTerima kasih telah berbelanja.`;
}

async function makeReceiptJpg(r) {
  if (typeof html2canvas !== 'function') {
    throw new Error('Fitur pembuat gambar belum termuat. Periksa koneksi internet lalu muat ulang aplikasi.');
  }

  // Render salinan khusus dengan lebar dan tipografi seperti struk di HP.
  // Elemen di layar tidak diubah, sehingga tampilan aplikasi tetap aman.
  const source = $('receiptContent');
  const exportWrap = document.createElement('div');
  exportWrap.setAttribute('aria-hidden', 'true');
  Object.assign(exportWrap.style, {
    position: 'fixed', left: '-10000px', top: '0', width: '360px',
    boxSizing: 'border-box', padding: '18px 14px', background: '#ffffff',
    color: '#17324d', fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '12px', lineHeight: '1.35', overflow: 'visible', zIndex: '-1'
  });
  const clone = source.cloneNode(true);
  clone.removeAttribute('id');
  Object.assign(clone.style, {
    display: 'block', width: '100%', maxWidth: 'none', margin: '0',
    padding: '0', boxSizing: 'border-box', background: '#ffffff',
    color: '#17324d', fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '12px', lineHeight: '1.35'
  });
  exportWrap.appendChild(clone);
  document.body.appendChild(exportWrap);

  try {
    const title = clone.querySelector('.receipt-title');
    if (title) Object.assign(title.style, {
      textAlign: 'center', padding: '0 0 12px', margin: '0 0 8px',
      borderBottom: '1px dashed #aab4bd'
    });
    const h2 = clone.querySelector('.receipt-title h2');
    if (h2) Object.assign(h2.style, {
      fontSize: '20px', lineHeight: '1.2', margin: '0 0 5px',
      fontWeight: '700', letterSpacing: '1px', color: '#17324d'
    });
    const titleP = clone.querySelector('.receipt-title p');
    if (titleP) Object.assign(titleP.style, { fontSize: '12px', margin: '12px 0 0', fontWeight: '400' });

    clone.querySelectorAll('.receipt-line').forEach((el, i) => {
      Object.assign(el.style, {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: '10px', margin: i < 3 ? '6px 0' : '5px 0', fontSize: '12px',
        lineHeight: '1.35', color: '#17324d'
      });
      const spans = el.querySelectorAll('span, strong');
      if (spans.length > 1) {
        spans[0].style.flex = '0 0 auto';
        spans[1].style.textAlign = 'right';
        spans[1].style.overflowWrap = 'anywhere';
      }
    });

    const items = clone.querySelector('.receipt-items');
    if (items) Object.assign(items.style, {
      borderTop: '1px dashed #aab4bd', borderBottom: '1px dashed #aab4bd',
      padding: '8px 0', margin: '10px 0'
    });
    clone.querySelectorAll('.receipt-items p').forEach(p => {
      Object.assign(p.style, { margin: '6px 0', fontSize: '12px', lineHeight: '1.35', color: '#17324d' });
      const small = p.querySelector('small');
      if (small) Object.assign(small.style, { display: 'block', fontSize: '10px', lineHeight: '1.4', color: '#17324d' });
    });
    clone.querySelectorAll('.receipt-items small span').forEach(el => {
      el.style.float = 'right';
      el.style.marginLeft = '8px';
    });
    const footer = clone.querySelector('p[style*="text-align:center"]');
    if (footer) Object.assign(footer.style, { textAlign: 'center', margin: '14px 0 0', fontSize: '12px', color: '#17324d' });

    // Tunggu font/layout stabil sebelum menangkap gambar.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await html2canvas(exportWrap, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true,
      logging: false, width: 360, windowWidth: 360, scrollX: 0, scrollY: 0
    });
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Gagal membuat gambar struk.'));
        resolve(new File([blob], `Struk-Yons-Agen-${r.id}.jpg`, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    });
  } finally {
    exportWrap.remove();
  }
}

$('shareReceipt').onclick = async () => {
  const r = state.lastReceipt;
  if (!r) return;
  
  const btn = $('shareReceipt');
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Menyiapkan JPG…';
  
  try {
    const file = await makeReceiptJpg(r);
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Struk Yons Agen', text: 'Struk belanja Yons Agen' });
      return;
    }
    
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    
    window.open('https://wa.me/?text=' + encodeURIComponent(receiptText(r)), '_blank', 'noopener');
    alert('Gambar struk JPG sudah diunduh. Di WhatsApp, lampirkan gambar JPG yang baru diunduh untuk mengirim struk sebagai gambar.');
  } catch (e) {
    if (e.name !== 'AbortError') alert('Tidak dapat berbagi JPG otomatis. ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
};

$('printReceipt').onclick = () => window.print();

function parseRupiahInput(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

function formatTargetInput() {
  const el = $('salesTarget');
  const value = parseRupiahInput(el.value);
  el.value = value ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value) : '';
}

$('salesTarget').addEventListener('input', () => {
  const el = $('salesTarget');
  const digits = el.value.replace(/[^0-9]/g, '');
  el.value = digits ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(digits)) : '';
});

$('salesTarget').addEventListener('blur', () => {
  if (!$('salesTarget').value)$('salesTarget').value = '0';
});

$('refreshDashboard').onclick = loadDashboard;
$('applyDashboard').onclick = loadDashboard;

async function loadDashboard() {
  try {
    const r = await api('dashboard', {
      period: $('period').value,
      target: parseRupiahInput($('salesTarget').value)
    });
    state.dashboard = r;
    renderDashboard(r);
  } catch (e) {
    $('dailyBars').innerHTML = '<p class="muted">' + esc(e.message) + '</p>';
    $('productAnalysis').innerHTML = '<p class="muted">' + esc(e.message) + '</p>';
  }
}

function pct(curr, prev) {
  if (!prev) return curr ? '+100%' : '0%';
  const v = (curr - prev) / prev * 100;
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}

function renderDashboard(r) {
  const s = r.summary;
  $('metricRevenue').textContent = rupiah(s.revenue);$('metricTransactions').textContent = s.transactions;
  $('metricItems').textContent = s.items;
  $('metricAverage').textContent = rupiah(s.transactions ? s.revenue / s.transactions : 0);
  $('metricRevenueChange').textContent = 'vs sebelumnya: ' + pct(s.revenue, r.previous.revenue);
  $('metricTransactionsChange').textContent = 'vs sebelumnya: ' + pct(s.transactions, r.previous.transactions);$('metricItemsChange').textContent = 'vs sebelumnya: ' + pct(s.items, r.previous.items);
  
  const target = Number(r.target) || 0;
  const percent = target ? Math.round(s.revenue / target * 100) : 0;
  $('targetPercent').textContent = percent + '%';
  $('targetBar').style.width = Math.min(100, Math.max(0, percent)) + '\%';$('actualLabel').textContent = 'Aktual: ' + rupiah(s.revenue);
  $('targetLabel').textContent = 'Target: ' + rupiah(target);$('comparisonText').textContent = `${pct(s.revenue, r.previous.revenue)} dibanding periode sebelumnya (${rupiah(r.previous.revenue)})`;
  
  const bars = r.daily || [];
  const max = Math.max(1, ...bars.map(x => x.revenue));
  $('dailyBars').innerHTML = bars.length ? bars.map(x => `<div class="bar-col" title="${esc(x.label)}: ${rupiah(x.revenue)}"><div class="bar" style="height:${Math.max(3, Math.round(x.revenue / max * 115))}px"></div><div>${esc(x.label)}</div><div>${x.revenue ? rupiah(x.revenue) : '—'}</div></div>`).join('') : '<p class="muted">Belum ada transaksi.</p>';
  
  const products = r.products || [];
  $('productAnalysis').innerHTML = products.length ? `<table class="analysis-table"><thead><tr><th>Produk</th><th>Qty terjual</th><th>Omzet</th><th>Estimasi laba kotor</th></tr></thead><tbody>${products.map(x => `<tr><td>${esc(x.nama)}</td><td>${Number(x.qty) || 0}${esc(x.satuan || '')}</td><td>${rupiah(x.revenue)}</td><td>${x.grossProfit === null || x.grossProfit === undefined ? '<span class="muted">Belum ada data modal</span>' : rupiah(x.grossProfit)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Belum ada penjualan pada periode ini.</p>';
}

formatTargetInput();
