/**
 * ShilpSahayak Admin Portal Engine (app.js)
 * Live Supabase Connection, User Profile Editing & Deletion System
 */

const SUPABASE_URL = "https://kwjjtocisauotehkpdwl.supabase.co";
const SUPABASE_KEY = "sb_publishable_XHnwUNs7wxb0fDn_5U_EJg_9uhRm3Q2";

let supabaseClient = null;
let liveConnected = false;

let catalogState = [];
let ordersState = [];
let profilesState = [];

// DOM References
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const kpiPending = document.getElementById('kpiPending');
const kpiProducts = document.getElementById('kpiProducts');
const kpiArtisans = document.getElementById('kpiArtisans');
const kpiVolume = document.getElementById('kpiVolume');
const pendingBadge = document.getElementById('pendingBadge');

const ordersTableBody = document.getElementById('ordersTableBody');
const productsTableBody = document.getElementById('productsTableBody');
const artisansTableBody = document.getElementById('artisansTableBody');
const dashboardPendingTbody = document.getElementById('dashboardPendingTbody');

// Page Startup Initialization
window.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  autoConnectSupabase();
});

// Auto-Connect using embedded configuration
async function autoConnectSupabase() {
  try {
    if (statusText) statusText.textContent = "Connecting...";
    if (statusPill) statusPill.className = "status-pill status-disconnected";

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Ping check
    const { error } = await supabaseClient.from('products').select('id', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') throw error;

    liveConnected = true;
    if (statusPill) statusPill.className = "status-pill status-connected";
    if (statusText) statusText.textContent = "Live Supabase Connected";

    showToast("Supabase Database Connected!");
    await fetchEverything();
  } catch (err) {
    liveConnected = false;
    if (statusPill) statusPill.className = "status-pill status-disconnected";
    if (statusText) statusText.textContent = "Connection Failed";
    console.error("Supabase connection error:", err);
    showToast("Connection failed: " + (err.message || "Network Error"));
  }
}

// Fetch all primary datasets
async function fetchEverything() {
  if (!liveConnected || !supabaseClient) return;

  try {
    const [prodRes, ordRes, profRes] = await Promise.all([
      supabaseClient.from('products').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('orders').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('profiles').select('*').order('created_at', { ascending: false })
    ]);

    catalogState = prodRes.data || [];
    ordersState = ordRes.data || [];
    profilesState = profRes.data || [];

    updateDashboardKPIs();
    renderOrdersTable();
    renderProductsTable();
    renderArtisansTable();
    renderDashboardPending();
  } catch (err) {
    console.error("Error fetching data:", err);
    showToast("Data fetch error: " + err.message);
  }
}

// Update KPI Summary Badges
function updateDashboardKPIs() {
  const pendingOrders = ordersState.filter(o => o.status === 'Under Confirmation' || !o.status);
  const totalVolume = ordersState.reduce((sum, o) => sum + Number(o.total_amount || o.amount || 0), 0);
  const artisanCount = profilesState.filter(p => (p.role || '').toLowerCase() === 'artisan').length;

  if (kpiPending) kpiPending.textContent = pendingOrders.length;
  if (kpiProducts) kpiProducts.textContent = catalogState.length;
  if (kpiArtisans) kpiArtisans.textContent = artisanCount;
  if (kpiVolume) kpiVolume.textContent = `₹${totalVolume.toLocaleString('en-IN')}`;

  if (pendingBadge) {
    if (pendingOrders.length > 0) {
      pendingBadge.style.display = 'inline-block';
      pendingBadge.textContent = pendingOrders.length;
    } else {
      pendingBadge.style.display = 'none';
    }
  }
}

// Orders Fulfillment Desk Table
function renderOrdersTable() {
  if (!ordersTableBody) return;
  const filter = document.getElementById('orderStatusFilter')?.value || 'ALL';

  const filtered = ordersState.filter(o => {
    if (filter === 'ALL') return true;
    return (o.status || 'Under Confirmation') === filter;
  });

  if (filtered.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-30 text-muted">No orders found for this status.</td></tr>`;
    return;
  }

  ordersTableBody.innerHTML = filtered.map(o => {
    const shortId = (o.id || '').substring(0, 8);
    const buyerProfile = profilesState.find(p => p.id === o.buyer_id);
    const buyerDisplay = (o.buyer_id || '').substring(0, 10);
    const itemPrice = o.item_price || o.price || (o.total_amount ? o.total_amount - 100 : 349);
    const shipPrice = o.shipping_fee ?? (o.payment_method === 'Cash on Delivery' ? 100 : 0);
    const total = o.total_amount || o.amount || (itemPrice + shipPrice);
    const status = o.status || 'Under Confirmation';
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '22/9/2026';

    const address = o.delivery_address || o.buyer_address || "Craft Nagar, Lane 4, Bhubaneswar, Odisha - 192303";
    const contactNumber = o.buyer_phone || buyerProfile?.phone || "+918917600253";

    return `
      <tr>
        <td class="font-mono">#${shortId}</td>
        <td><strong>${escapeHtml(o.product_title || 'Handcrafted Craft')}</strong></td>
        <td>
          <div style="max-width: 260px; font-size: 13px;">
            ${escapeHtml(address)}<br>
            <small class="text-muted">Buyer: ${escapeHtml(buyerDisplay)}</small><br>
            <small class="text-muted">Contact: <strong>${escapeHtml(contactNumber)}</strong></small>
          </div>
        </td>
        <td>
          <strong>₹${total}</strong><br>
          <small class="text-muted">Item ₹${itemPrice} + Ship ₹${shipPrice}</small>
        </td>
        <td>${escapeHtml(o.payment_method || 'UPI')}</td>
        <td>
          <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
            <option value="Under Confirmation" ${status === 'Under Confirmation' ? 'selected' : ''}>Under Confirmation</option>
            <option value="Direct Escrow Confirmed" ${status === 'Direct Escrow Confirmed' ? 'selected' : ''}>Direct Escrow Confirmed</option>
            <option value="Crafting in Progress" ${status === 'Crafting in Progress' ? 'selected' : ''}>Crafting in Progress</option>
            <option value="Shipped via India Post" ${status === 'Shipped via India Post' ? 'selected' : ''}>Shipped via India Post</option>
            <option value="Delivered & Escrow Released" ${status === 'Delivered & Escrow Released' ? 'selected' : ''}>Delivered & Escrow Released</option>
          </select>
        </td>
        <td>${dateStr}</td>
        <td class="text-right">
          <button class="btn-icon text-danger" title="Delete Order" onclick="deleteOrder('${o.id}')">
            <i class="ph ph-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Update Order Status in Supabase
async function updateOrderStatus(orderId, newStatus) {
  try {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) throw error;

    showToast(`Order status updated to: ${newStatus}`);
    await fetchEverything();
  } catch (err) {
    showToast("Update failed: " + err.message);
  }
}

// Delete an Order
async function deleteOrder(orderId) {
  if (!confirm("Are you sure you want to delete this order record?")) return;
  try {
    const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
    if (error) throw error;
    showToast("Order removed successfully.");
    await fetchEverything();
  } catch (err) {
    showToast("Delete failed: " + err.message);
  }
}

// Overview Section Pending Orders List
function renderDashboardPending() {
  if (!dashboardPendingTbody) return;
  const pending = ordersState.filter(o => (o.status || 'Under Confirmation') === 'Under Confirmation');

  if (pending.length === 0) {
    dashboardPendingTbody.innerHTML = `<tr><td colspan="6" class="text-center py-20 text-muted">No orders awaiting confirmation.</td></tr>`;
    return;
  }

  dashboardPendingTbody.innerHTML = pending.map(o => `
    <tr>
      <td class="font-mono">#${(o.id || '').substring(0, 8)}</td>
      <td><strong>${escapeHtml(o.product_title || 'Craft Product')}</strong></td>
      <td>${escapeHtml(o.delivery_address || o.buyer_address || 'PIN: N/A')}</td>
      <td>₹${o.total_amount || o.amount || 0}</td>
      <td>${escapeHtml(o.payment_method || 'Cash / QR')}</td>
      <td class="text-right">
        <button class="btn btn-sm btn-maroon" onclick="updateOrderStatus('${o.id}', 'Direct Escrow Confirmed')">
          Confirm Escrow
        </button>
      </td>
    </tr>
  `).join('');
}

// Craft Catalog Table
function renderProductsTable() {
  if (!productsTableBody) return;
  const searchTerm = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const cluster = document.getElementById('clusterFilter')?.value || 'ALL';

  const filtered = catalogState.filter(p => {
    const matchCluster = cluster === 'ALL' || p.category === cluster;
    const matchSearch = !searchTerm || 
      (p.title || '').toLowerCase().includes(searchTerm) ||
      (p.artisan_name || '').toLowerCase().includes(searchTerm) ||
      (p.artisan_pincode || '').includes(searchTerm);
    return matchCluster && matchSearch;
  });

  if (filtered.length === 0) {
    productsTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-30 text-muted">No crafts match search criteria.</td></tr>`;
    return;
  }

  productsTableBody.innerHTML = filtered.map(p => {
    const rawImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : (p.image_url || '');
    const imgUrl = rawImg ? rawImg : 'https://via.placeholder.com/50';

    return `
      <tr>
        <td style="width: 70px;">
          <img src="${imgUrl}" alt="craft" class="table-thumb" onerror="this.src='https://via.placeholder.com/50'">
        </td>
        <td><strong>${escapeHtml(p.title || 'Untitled Craft')}</strong></td>
        <td>${escapeHtml(p.artisan_name || 'Master Artisan')}<br><small class="text-muted">PIN: ${p.artisan_pincode || '751024'}</small></td>
        <td><span class="badge badge-cluster">${escapeHtml(p.category || 'Tribal Art')}</span></td>
        <td>${p.labor_hours || 4}h / ₹${p.material_cost || 50}</td>
        <td><strong>₹${p.price}</strong></td>
        <td><span class="badge badge-verified">Compliant</span></td>
        <td class="text-right">
          <button class="btn-icon" title="View Beckn ONDC JSON" onclick="viewBecknJson('${p.id}')">
            <i class="ph ph-brackets-curly"></i>
          </button>
          <button class="btn-icon" title="Edit Craft" onclick="openEditProductModal('${p.id}')">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="btn-icon text-danger" title="Delete Craft" onclick="deleteProduct('${p.id}')">
            <i class="ph ph-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------
// USER MANAGEMENT SYSTEM: RENDER, EDIT & DELETE USERS
// -------------------------------------------------------------

// Render Users Directory with Edit and Delete Action Buttons
function renderArtisansTable() {
  if (!artisansTableBody) return;
  const roleFilter = document.getElementById('userRoleFilter')?.value || 'ALL';

  const filteredUsers = profilesState.filter(u => {
    if (roleFilter === 'ALL') return true;
    return (u.role || '').toLowerCase() === roleFilter.toLowerCase();
  });

  if (filteredUsers.length === 0) {
    artisansTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No users found for the selected filter.</td></tr>`;
    return;
  }

  artisansTableBody.innerHTML = filteredUsers.map(u => {
    const isArtisan = (u.role || '').toLowerCase() === 'artisan';
    const roleBadgeStyle = isArtisan
      ? 'background: #fce7eb; color: #6c1d28; font-weight: 700;'
      : 'background: #e0f2fe; color: #0369a1; font-weight: 700;';

    const cardId = u.artisan_card_id || (isArtisan ? 'PV-8832-1920' : 'N/A (Buyer)');
    const locationInfo = u.address
      ? `${escapeHtml(u.address)}<br><small class="text-muted">PIN: ${u.pincode || '751024'}</small>`
      : (isArtisan ? 'Craft Workshop<br><small class="text-muted">PIN: 751024</small>' : '<span class="text-muted">Direct Buyer</span>');

    return `
      <tr>
        <td><strong>${escapeHtml(u.full_name || 'Registered User')}</strong></td>
        <td>${escapeHtml(u.phone || '+91 9876543210')}</td>
        <td>
          <span class="badge" style="${roleBadgeStyle}">
            ${escapeHtml(u.role || 'user')}
          </span>
        </td>
        <td><span class="badge badge-id">${escapeHtml(cardId)}</span></td>
        <td>${locationInfo}</td>
        <td class="font-mono text-muted">${(u.id || '').substring(0, 12)}...</td>
        <td class="text-right">
          <button class="btn-icon" title="Edit User Details" onclick="openEditUserModal('${u.id}')">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="btn-icon text-danger" title="Delete User" onclick="deleteUser('${u.id}', '${escapeHtml(u.full_name || 'this user')}')">
            <i class="ph ph-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Edit User Modal with populated data
function openEditUserModal(userId) {
  const user = profilesState.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('editUserId').value = user.id;
  document.getElementById('userFormName').value = user.full_name || '';
  document.getElementById('userFormPhone').value = user.phone || '';
  document.getElementById('userFormRole').value = (user.role || 'artisan').toLowerCase();
  document.getElementById('userFormCardId').value = user.artisan_card_id || '';
  document.getElementById('userFormAddress').value = user.address || '';
  document.getElementById('userFormPincode').value = user.pincode || '';

  document.getElementById('userModalTitle').textContent = `Edit User: ${user.full_name || 'Account'}`;
  openModal('userModal');
}

// Handle User Edit Submit to Supabase
async function handleUserFormSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('editUserId').value;
  if (!userId) return;

  const payload = {
    full_name: document.getElementById('userFormName').value.trim(),
    phone: document.getElementById('userFormPhone').value.trim(),
    role: document.getElementById('userFormRole').value,
    artisan_card_id: document.getElementById('userFormCardId').value.trim() || null,
    address: document.getElementById('userFormAddress').value.trim() || null,
    pincode: document.getElementById('userFormPincode').value.trim() || null,
  };

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) throw error;

    showToast("User details updated successfully!");
    closeModal('userModal');
    await fetchEverything();
  } catch (err) {
    showToast("Error updating user: " + err.message);
  }
}

// Delete User from Supabase
async function deleteUser(userId, userName) {
  if (!confirm(`Are you sure you want to completely remove user "${userName}" from the database?`)) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    showToast(`User "${userName}" deleted successfully.`);
    await fetchEverything();
  } catch (err) {
    showToast("Failed to delete user: " + err.message);
  }
}

// -------------------------------------------------------------
// PRODUCT OPERATIONS & BECKN PROTOCOL
// -------------------------------------------------------------
function openNewProductModal() {
  document.getElementById('productForm').reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('productModalTitle').textContent = "Add New Craft Product";
  openModal('productModal');
}

function openEditProductModal(id) {
  const product = catalogState.find(p => p.id === id);
  if (!product) return;

  document.getElementById('editProductId').value = product.id;
  document.getElementById('formTitle').value = product.title || '';
  document.getElementById('formArtisanName').value = product.artisan_name || '';
  document.getElementById('formCategory').value = product.category || 'Tribal Art / Toys';
  document.getElementById('formPrice').value = product.price || '';
  document.getElementById('formPincode').value = product.artisan_pincode || '751024';
  document.getElementById('formLaborHours').value = product.labor_hours || 4;
  document.getElementById('formMaterialCost').value = product.material_cost || 50;
  document.getElementById('formImageUrl').value = (product.image_urls && product.image_urls[0]) || product.image_url || '';
  document.getElementById('formDescription').value = product.product_description || '';
  document.getElementById('formStory').value = product.story || '';

  document.getElementById('productModalTitle').textContent = "Edit Craft Listing";
  openModal('productModal');
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editProductId').value;
  const payload = {
    title: document.getElementById('formTitle').value.trim(),
    artisan_name: document.getElementById('formArtisanName').value.trim(),
    category: document.getElementById('formCategory').value,
    price: parseFloat(document.getElementById('formPrice').value),
    artisan_pincode: document.getElementById('formPincode').value.trim(),
    labor_hours: parseInt(document.getElementById('formLaborHours').value),
    material_cost: parseInt(document.getElementById('formMaterialCost').value),
    product_description: document.getElementById('formDescription').value.trim(),
    story: document.getElementById('formStory').value.trim(),
  };

  const img = document.getElementById('formImageUrl').value.trim();
  if (img) payload.image_urls = [img];

  try {
    if (id) {
      const { error } = await supabaseClient.from('products').update(payload).eq('id', id);
      if (error) throw error;
      showToast("Craft updated successfully!");
    } else {
      const { error } = await supabaseClient.from('products').insert([payload]);
      if (error) throw error;
      showToast("Craft added to catalog!");
    }
    closeModal('productModal');
    await fetchEverything();
  } catch (err) {
    showToast("Error saving craft: " + err.message);
  }
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this craft?")) return;
  try {
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if (error) throw error;
    showToast("Craft deleted.");
    await fetchEverything();
  } catch (err) {
    showToast("Delete failed: " + err.message);
  }
}

// ONDC Beckn Protocol Schema Viewer
function viewBecknJson(productId) {
  const p = catalogState.find(item => item.id === productId);
  if (!p) return;

  const becknPayload = {
    context: {
      domain: "nic2004:52110",
      country: "IND",
      city: `std:${(p.artisan_pincode || '751024').substring(0, 3)}`,
      action: "on_search",
      core_version: "1.0.0",
      bap_id: "buyer-app.ondc.org",
      bpp_id: "shilpsahayak.artisan.gateway"
    },
    message: {
      catalog: {
        "bpp/descriptor": {
          name: "ShilpSahayak Artisan Fair-Trade Cooperative",
          code: "SHILP-ODISHA-CLUSTER"
        },
        "bpp/providers": [{
          id: p.artisan_id || "PV-8832-1920",
          descriptor: { name: p.artisan_name || "Tribal Artisan" },
          items: [{
            id: p.id,
            descriptor: {
              name: p.title,
              short_desc: p.product_description || "",
              long_desc: p.story || ""
            },
            price: { currency: "INR", value: `${p.price}.00` },
            category_id: p.category,
            fulfillment_id: `IN-POST-${p.artisan_pincode || '751024'}`
          }]
        }]
      }
    }
  };

  document.getElementById('becknJsonOutput').textContent = JSON.stringify(becknPayload, null, 2);
  openModal('becknModal');
}

function copyBecknJson() {
  const text = document.getElementById('becknJsonOutput').textContent;
  navigator.clipboard.writeText(text);
  showToast("Beckn JSON copied to clipboard!");
}

// Tab Navigation Controller
function setupNavigation() {
  window.switchTab = function(tabName) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-pane').forEach(el => {
      el.classList.toggle('active', el.id === `section-${tabName}`);
    });
  };
}

// UI Controls
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}