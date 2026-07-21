(() => {
  "use strict";

  const config = window.DU2BAO2_CONFIG || {};
  const categories = window.DU2BAO2_CATEGORIES || [];
  const demoProducts = window.DU2BAO2_DEMO_PRODUCTS || [];
  const hasSupabaseConfig = Boolean(
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes("YOUR_")
  );

  const supabaseClient = hasSupabaseConfig && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  const state = {
    products: [],
    activeCategory: "All",
    currentUser: null,
    authMode: "login",
    wishlist: new Set(JSON.parse(localStorage.getItem("du2bao2-wishlist") || "[]")),
    photoUrls: [],
    loading: true
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0
  });

  const productGrid = $("#productGrid");
  const loadingGrid = $("#loadingGrid");
  const emptyState = $("#emptyState");
  const searchInput = $("#searchInput");
  const conditionSelect = $("#conditionSelect");
  const sortSelect = $("#sortSelect");
  const listingSummary = $("#listingSummary");
  const toast = $("#toast");
  const modeBanner = $("#modeBanner");

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[char]);
  }

  function normalizePhone(value = "") {
    return String(value).replace(/\D/g, "");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setMessage(element, message = "", type = "") {
    element.textContent = message;
    element.className = `form-message ${type}`.trim();
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    document.body.classList.add("dialog-open");
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (dialog.open) dialog.close();
    if (!$("dialog[open]")) document.body.classList.remove("dialog-open");
  }

  function setupDialogControls() {
    // Capture close-button clicks before any form or page handler can interfere.
    document.addEventListener("click", (event) => {
      const closeButton = event.target.closest("[data-close-dialog]");
      if (!closeButton) return;

      event.preventDefault();
      event.stopPropagation();
      closeDialog(closeButton.dataset.closeDialog);
    }, true);

    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("close", () => {
        if (!$("dialog[open]")) document.body.classList.remove("dialog-open");
      });

      // Clicking the dark backdrop also closes the dialog.
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog.id);
      });
    });
  }

  function productImage(product) {
    const first = product.images?.[0];
    if (first) {
      return `<img src="${escapeHTML(first)}" alt="${escapeHTML(product.title)}" loading="lazy" />`;
    }
    return `<div class="visual" aria-hidden="true">${escapeHTML(product.visual || product.brand?.slice(0, 2) || "DU")}</div>`;
  }

  function normalizeListing(row) {
    const imageRows = Array.isArray(row.listing_images) ? row.listing_images : [];
    const images = imageRows
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((item) => item.image_url)
      .filter(Boolean);

    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      brand: row.brand || "UNBRANDED",
      title: row.title || "Untitled item",
      category: row.category || "Miscellaneous",
      price: Number(row.price || 0),
      condition: row.condition || "Good",
      location: row.location || "Malaysia",
      description: row.description || "",
      badge: row.badge || "Admin reviewed",
      status: row.status || "pending",
      visual: row.visual || (row.brand || "DU").slice(0, 2).toUpperCase(),
      created_at: row.created_at || new Date().toISOString(),
      seller_id: row.seller_id,
      seller_name: profile?.display_name || row.seller_name || "DU2BAO2 Seller",
      seller_whatsapp: profile?.whatsapp || row.seller_whatsapp || "",
      seller_verified: Boolean(profile?.is_verified || row.seller_verified),
      images
    };
  }

  async function fetchApprovedListings() {
    state.loading = true;
    loadingGrid.hidden = false;
    productGrid.hidden = true;
    emptyState.hidden = true;

    if (!supabaseClient) {
      const locallyApproved = getDemoListings().filter((item) => item.status === "approved");
      state.products = [...locallyApproved, ...demoProducts];
      state.loading = false;
      modeBanner.hidden = false;
      modeBanner.innerHTML = "<strong>Setup mode:</strong> the design is working with sample data. Add your Supabase URL and anon key in <code>config.js</code> to use real accounts, listings, uploads and approvals.";
      renderProducts();
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from("listings")
        .select("*, listing_images(image_url, sort_order), profiles(display_name, whatsapp, is_verified)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;
      state.products = (data || []).map(normalizeListing);
      modeBanner.hidden = true;
    } catch (error) {
      console.error(error);
      state.products = demoProducts;
      modeBanner.hidden = false;
      modeBanner.textContent = "The live database could not be loaded, so sample listings are being shown. Check your Supabase tables, policies and config.js values.";
    } finally {
      state.loading = false;
      renderProducts();
    }
  }

  function filteredProducts() {
    const query = searchInput.value.toLowerCase().trim();
    const condition = conditionSelect.value;
    const items = state.products.filter((product) => {
      const categoryMatch = state.activeCategory === "All" || product.category === state.activeCategory;
      const conditionMatch = condition === "All" || product.condition === condition;
      const searchable = `${product.brand} ${product.title} ${product.location} ${product.category}`.toLowerCase();
      return categoryMatch && conditionMatch && searchable.includes(query);
    });

    if (sortSelect.value === "low") items.sort((a, b) => a.price - b.price);
    if (sortSelect.value === "high") items.sort((a, b) => b.price - a.price);
    if (sortSelect.value === "newest") {
      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return items;
  }

  function renderProducts() {
    loadingGrid.hidden = true;
    productGrid.hidden = false;

    const items = filteredProducts();
    listingSummary.textContent = `${items.length} approved listing${items.length === 1 ? "" : "s"} shown`;
    productGrid.innerHTML = items.map((product) => {
      const saved = state.wishlist.has(String(product.id));
      const detailUrl = `product.html?id=${encodeURIComponent(product.id)}`;
      return `
        <article class="product-card">
          <a class="product-link" href="${detailUrl}" aria-label="View ${escapeHTML(product.title)}">
            <div class="product-image">
              <span class="badge">${escapeHTML(product.badge || "Approved")}</span>
              ${productImage(product)}
            </div>
            <div class="product-copy">
              <span class="brand-name">${escapeHTML(product.brand)}</span>
              <h3>${escapeHTML(product.title)}</h3>
              <div class="price-line">
                <span class="price">${money.format(product.price)}</span>
                <span class="condition">${escapeHTML(product.condition)}</span>
              </div>
              <div class="product-meta"><span>${escapeHTML(product.category)}</span><span>${escapeHTML(product.location)}</span></div>
            </div>
          </a>
          <button class="heart ${saved ? "saved" : ""}" data-wishlist-id="${escapeHTML(product.id)}" aria-label="${saved ? "Remove" : "Save"} ${escapeHTML(product.title)}">${saved ? "♥" : "♡"}</button>
        </article>`;
    }).join("");

    emptyState.hidden = items.length > 0;
    bindWishlistButtons();
  }

  function renderCategories() {
    const icons = {
      All: "✦",
      "Luxury Bags": "▱",
      Watches: "◷",
      Fashion: "♢",
      Technology: "⌘",
      Jewelry: "◇",
      Accessories: "⌁",
      Miscellaneous: "✧"
    };

    $("#categoryButtons").innerHTML = ["All", ...categories].map((category) => `
      <button class="category ${category === "All" ? "active" : ""}" data-category="${escapeHTML(category)}">
        <span>${icons[category] || "•"}</span>${escapeHTML(category)}
      </button>`).join("");

    $("#sellCategory").innerHTML = categories.map((category) => `<option>${escapeHTML(category)}</option>`).join("");

    $$(".category").forEach((button) => button.addEventListener("click", () => {
      $$(".category").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.activeCategory = button.dataset.category;
      renderProducts();
    }));
  }

  function updateWishlistUI() {
    $$(".wishlist-count").forEach((element) => {
      element.textContent = state.wishlist.size;
    });
    localStorage.setItem("du2bao2-wishlist", JSON.stringify([...state.wishlist]));
  }

  function toggleWishlist(id) {
    const key = String(id);
    if (state.wishlist.has(key)) {
      state.wishlist.delete(key);
      showToast("Removed from wishlist");
    } else {
      state.wishlist.add(key);
      showToast("Saved to wishlist");
    }
    updateWishlistUI();
    renderProducts();
  }

  function bindWishlistButtons() {
    $$('[data-wishlist-id]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(button.dataset.wishlistId);
      });
    });
  }

  function renderWishlist() {
    const savedProducts = state.products.filter((product) => state.wishlist.has(String(product.id)));
    $("#emptyWishlist").hidden = savedProducts.length > 0;
    $("#wishlistList").innerHTML = savedProducts.map((product) => `
      <article class="mini-card">
        <div class="mini-image">${product.images?.[0] ? `<img src="${escapeHTML(product.images[0])}" alt="" />` : escapeHTML(product.visual || "DU")}</div>
        <div class="mini-copy"><strong>${escapeHTML(product.title)}</strong><span>${escapeHTML(product.brand)} · ${money.format(product.price)}</span></div>
        <div class="mini-actions"><a href="product.html?id=${encodeURIComponent(product.id)}">View</a><button data-remove-wishlist="${escapeHTML(product.id)}">Remove</button></div>
      </article>`).join("");

    $$('[data-remove-wishlist]').forEach((button) => button.addEventListener("click", () => {
      state.wishlist.delete(String(button.dataset.removeWishlist));
      updateWishlistUI();
      renderWishlist();
      renderProducts();
    }));
  }

  function getDemoListings() {
    return JSON.parse(localStorage.getItem("du2bao2-demo-listings") || "[]");
  }

  function saveDemoListings(listings) {
    localStorage.setItem("du2bao2-demo-listings", JSON.stringify(listings));
  }

  function getDemoUser() {
    return JSON.parse(localStorage.getItem("du2bao2-demo-user") || "null");
  }

  function isAdmin() {
    const email = state.currentUser?.email?.toLowerCase();
    return Boolean(email && (config.ADMIN_EMAILS || []).some((item) => item.toLowerCase() === email));
  }

  function userDisplayName() {
    return state.currentUser?.user_metadata?.display_name || state.currentUser?.display_name || state.currentUser?.email?.split("@")[0] || "Seller";
  }

  function updateAccountUI() {
    const loggedIn = Boolean(state.currentUser);
    const label = loggedIn ? userDisplayName() : "Log in";
    [$("#accountButton"), $("#mobileAccountButton"), $("#footerAccountButton")].forEach((button) => {
      if (button) button.textContent = label;
    });
    $("#signedOutPanel").hidden = loggedIn;
    $("#signedInPanel").hidden = !loggedIn;
    if (loggedIn) {
      $("#accountName").textContent = `Hello, ${userDisplayName()}`;
      $("#accountEmail").textContent = state.currentUser.email || "Demo account";
      $("#adminButton").hidden = !isAdmin();
    }
  }

  async function initializeAuth() {
    if (!supabaseClient) {
      state.currentUser = getDemoUser();
      updateAccountUI();
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    state.currentUser = data.session?.user || null;
    updateAccountUI();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      state.currentUser = session?.user || null;
      updateAccountUI();
    });
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const registering = mode === "register";
    $("#loginTab").classList.toggle("active", !registering);
    $("#registerTab").classList.toggle("active", registering);
    $("#authHeading").textContent = registering ? "Create an account" : "Log in";
    $("#authSubmitButton").textContent = registering ? "Create account" : "Log in";
    $(".register-only").hidden = !registering;
    $("#authForm").elements.password.autocomplete = registering ? "new-password" : "current-password";
    setMessage($("#authMessage"));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const displayName = String(formData.get("display_name") || "").trim();
    const submitButton = $("#authSubmitButton");
    submitButton.disabled = true;
    setMessage($("#authMessage"), "Working…");

    try {
      if (!supabaseClient) {
        state.currentUser = {
          id: `demo-${email}`,
          email,
          user_metadata: { display_name: displayName || email.split("@")[0] }
        };
        localStorage.setItem("du2bao2-demo-user", JSON.stringify(state.currentUser));
        updateAccountUI();
        setMessage($("#authMessage"), "Demo account ready. Connect Supabase for real authentication.", "success");
        setTimeout(() => closeDialog("authDialog"), 600);
        return;
      }

      if (state.authMode === "register") {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } }
        });
        if (error) throw error;
        if (data.user) {
          await supabaseClient.from("profiles").upsert({
            id: data.user.id,
            display_name: displayName || email.split("@")[0]
          }, { onConflict: "id" });
        }
        setMessage($("#authMessage"), data.session ? "Account created." : "Account created. Check your email to confirm it.", "success");
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage($("#authMessage"), "Logged in successfully.", "success");
        setTimeout(() => closeDialog("authDialog"), 500);
      }
    } catch (error) {
      console.error(error);
      setMessage($("#authMessage"), error.message || "Unable to continue. Please check your details.", "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    localStorage.removeItem("du2bao2-demo-user");
    state.currentUser = null;
    updateAccountUI();
    closeDialog("authDialog");
    showToast("Logged out");
  }

  function requireAccount(action) {
    if (state.currentUser) {
      action();
      return;
    }
    setAuthMode("login");
    openDialog("authDialog");
    showToast("Log in or register first");
  }

  function validatePhotos(files) {
    if (files.length > 6) return "Please choose no more than 6 photos.";
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    for (const file of files) {
      if (!allowed.includes(file.type)) return "Only JPG, PNG and WebP photos are accepted.";
      if (file.size > 5 * 1024 * 1024) return `${file.name} is larger than 5 MB.`;
    }
    return "";
  }

  function previewPhotos(files) {
    state.photoUrls.forEach((url) => URL.revokeObjectURL(url));
    state.photoUrls = files.map((file) => URL.createObjectURL(file));
    $("#photoPreview").innerHTML = state.photoUrls.map((url) => `<img src="${url}" alt="Selected product photo preview" />`).join("");
  }

  async function uploadListingPhotos(listingId, files) {
    const imageRecords = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${state.currentUser.id}/${listingId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabaseClient.storage
        .from("listing-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabaseClient.storage.from("listing-images").getPublicUrl(path);
      imageRecords.push({ listing_id: listingId, image_url: data.publicUrl, storage_path: path, sort_order: index });
    }
    if (imageRecords.length) {
      const { error } = await supabaseClient.from("listing_images").insert(imageRecords);
      if (error) throw error;
    }
  }

  async function handleListingSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = [...form.elements.photos.files];
    const photoError = validatePhotos(files);
    const message = $("#sellFormMessage");
    const submitButton = $("#submitListingButton");

    if (photoError) {
      setMessage(message, photoError, "error");
      return;
    }

    submitButton.disabled = true;
    setMessage(message, "Saving your listing…");

    const payload = {
      seller_id: state.currentUser?.id,
      title: String(formData.get("title") || "").trim(),
      brand: String(formData.get("brand") || "").trim(),
      category: String(formData.get("category") || "Miscellaneous"),
      price: Number(formData.get("price")),
      condition: String(formData.get("condition") || "Good"),
      location: String(formData.get("location") || "Malaysia").trim(),
      description: String(formData.get("description") || "").trim(),
      status: "pending"
    };

    try {
      if (!supabaseClient) {
        const listings = getDemoListings();
        listings.unshift({
          ...payload,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
          seller_name: String(formData.get("seller_name") || userDisplayName()),
          seller_whatsapp: normalizePhone(formData.get("seller_whatsapp") || config.WHATSAPP_NUMBER),
          seller_verified: false,
          badge: "Pending review",
          visual: payload.brand.slice(0, 2).toUpperCase(),
          images: state.photoUrls
        });
        saveDemoListings(listings);
      } else {
        const sellerName = String(formData.get("seller_name") || userDisplayName()).trim();
        const whatsapp = normalizePhone(formData.get("seller_whatsapp") || "");
        await supabaseClient.from("profiles").upsert({
          id: state.currentUser.id,
          display_name: sellerName,
          whatsapp
        }, { onConflict: "id" });

        const { data, error } = await supabaseClient.from("listings").insert(payload).select().single();
        if (error) throw error;
        await uploadListingPhotos(data.id, files);
      }

      form.reset();
      previewPhotos([]);
      setMessage(message, "Listing submitted. It is now visible in your seller dashboard and waiting for admin approval.", "success");
      showToast("Listing submitted for approval");
      setTimeout(() => {
        closeDialog("sellDialog");
        openDashboard();
      }, 800);
    } catch (error) {
      console.error(error);
      setMessage(message, error.message || "The listing could not be saved. Please try again.", "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function getOwnListings() {
    if (!state.currentUser) return [];
    if (!supabaseClient) {
      return getDemoListings().filter((item) => item.seller_id === state.currentUser.id);
    }

    const { data, error } = await supabaseClient
      .from("listings")
      .select("*, listing_images(image_url, sort_order)")
      .eq("seller_id", state.currentUser.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeListing);
  }

  function statusPill(status) {
    return `<span class="status-pill status-${escapeHTML(status)}">${escapeHTML(status)}</span>`;
  }

  async function openDashboard() {
    closeDialog("authDialog");
    openDialog("dashboardDialog");
    $("#dashboardList").innerHTML = "<p class=\"empty-mini\">Loading your listings…</p>";
    try {
      const listings = await getOwnListings();
      const counts = ["pending", "approved", "rejected", "sold"].map((status) => ({
        status,
        count: listings.filter((item) => item.status === status).length
      }));
      $("#dashboardSummary").innerHTML = counts.map((item) => `<div><strong>${item.count}</strong><span>${item.status}</span></div>`).join("");
      $("#dashboardList").innerHTML = listings.length ? listings.map((item) => `
        <article class="mini-card">
          <div class="mini-image">${item.images?.[0] ? `<img src="${escapeHTML(item.images[0])}" alt="" />` : escapeHTML(item.visual || item.brand?.slice(0, 2) || "DU")}</div>
          <div class="mini-copy"><strong>${escapeHTML(item.title)}</strong><span>${money.format(item.price)} · ${escapeHTML(item.category)}</span>${statusPill(item.status)}</div>
          <div class="mini-actions">${item.status === "approved" ? `<a href="product.html?id=${encodeURIComponent(item.id)}">View live</a>` : ""}<button data-mark-sold="${escapeHTML(item.id)}" ${item.status !== "approved" ? "disabled" : ""}>Mark sold</button></div>
        </article>`).join("") : "<p class=\"empty-mini\">You have not submitted any listings yet.</p>";
      $$('[data-mark-sold]').forEach((button) => button.addEventListener("click", () => markListingSold(button.dataset.markSold)));
    } catch (error) {
      console.error(error);
      $("#dashboardList").innerHTML = `<p class="empty-mini">${escapeHTML(error.message || "Unable to load your listings.")}</p>`;
    }
  }

  async function markListingSold(id) {
    try {
      if (!supabaseClient) {
        const listings = getDemoListings();
        const target = listings.find((item) => String(item.id) === String(id));
        if (target) target.status = "sold";
        saveDemoListings(listings);
      } else {
        const { error } = await supabaseClient.from("listings").update({ status: "sold" }).eq("id", id).eq("seller_id", state.currentUser.id);
        if (error) throw error;
      }
      showToast("Listing marked as sold");
      await openDashboard();
      await fetchApprovedListings();
    } catch (error) {
      showToast(error.message || "Unable to update listing");
    }
  }

  async function getPendingListings() {
    if (!supabaseClient) return getDemoListings().filter((item) => item.status === "pending");
    const { data, error } = await supabaseClient
      .from("listings")
      .select("*, listing_images(image_url, sort_order), profiles(display_name, whatsapp, is_verified)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizeListing);
  }

  async function openAdmin() {
    if (!isAdmin()) {
      showToast("This account is not listed as an admin in config.js");
      return;
    }
    closeDialog("authDialog");
    openDialog("adminDialog");
    $("#adminList").innerHTML = "<p class=\"empty-mini\">Loading pending listings…</p>";
    try {
      const listings = await getPendingListings();
      $("#adminList").innerHTML = listings.length ? listings.map((item) => `
        <article class="mini-card">
          <div class="mini-image">${item.images?.[0] ? `<img src="${escapeHTML(item.images[0])}" alt="" />` : escapeHTML(item.visual || item.brand?.slice(0, 2) || "DU")}</div>
          <div class="mini-copy"><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.brand)} · ${money.format(item.price)} · ${escapeHTML(item.seller_name || "Seller")}</span>${statusPill(item.status)}</div>
          <div class="mini-actions"><button class="approve" data-admin-action="approved" data-id="${escapeHTML(item.id)}">Approve</button><button class="reject" data-admin-action="rejected" data-id="${escapeHTML(item.id)}">Reject</button></div>
        </article>`).join("") : "<p class=\"empty-mini\">There are no listings waiting for approval.</p>";
      $$('[data-admin-action]').forEach((button) => button.addEventListener("click", () => moderateListing(button.dataset.id, button.dataset.adminAction)));
    } catch (error) {
      console.error(error);
      $("#adminList").innerHTML = `<p class="empty-mini">${escapeHTML(error.message || "Unable to load approvals.")}</p>`;
    }
  }

  async function moderateListing(id, status) {
    try {
      if (!supabaseClient) {
        const listings = getDemoListings();
        const target = listings.find((item) => String(item.id) === String(id));
        if (target) {
          target.status = status;
          target.badge = status === "approved" ? "Admin reviewed" : "Rejected";
        }
        saveDemoListings(listings);
      } else {
        const { error } = await supabaseClient.from("listings").update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: state.currentUser.id
        }).eq("id", id);
        if (error) throw error;
      }
      showToast(status === "approved" ? "Listing approved" : "Listing rejected");
      await openAdmin();
      await fetchApprovedListings();
    } catch (error) {
      showToast(error.message || "Unable to update approval");
    }
  }

  function openAccount() {
    updateAccountUI();
    openDialog("authDialog");
  }

  function openSellForm() {
    requireAccount(() => {
      setMessage($("#sellFormMessage"));
      openDialog("sellDialog");
    });
  }

  function openWishlist() {
    renderWishlist();
    openDialog("wishlistDialog");
  }

  function setupDrawer() {
    const drawer = $("#mobileDrawer");
    const overlay = $("#drawerOverlay");
    const menuButton = $("#mobileMenuButton");
    const close = () => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      overlay.hidden = true;
      menuButton.setAttribute("aria-expanded", "false");
    };
    menuButton.addEventListener("click", () => {
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
      overlay.hidden = false;
      menuButton.setAttribute("aria-expanded", "true");
    });
    $("#drawerClose").addEventListener("click", close);
    overlay.addEventListener("click", close);
    $$("a, button", drawer).forEach((element) => {
      if (element.id !== "drawerClose") element.addEventListener("click", close);
    });
  }

  function bindEvents() {
    searchInput.addEventListener("input", renderProducts);
    conditionSelect.addEventListener("change", renderProducts);
    sortSelect.addEventListener("change", renderProducts);
    $("#clearFiltersButton").addEventListener("click", () => {
      searchInput.value = "";
      conditionSelect.value = "All";
      sortSelect.value = "newest";
      state.activeCategory = "All";
      $$(".category").forEach((button) => button.classList.toggle("active", button.dataset.category === "All"));
      renderProducts();
    });

    $$(".sell-trigger").forEach((button) => button.addEventListener("click", openSellForm));
    $$(".wishlist-trigger").forEach((button) => button.addEventListener("click", openWishlist));
    [$("#accountButton"), $("#mobileAccountButton"), $("#footerAccountButton"), $("#bottomAccountButton")].forEach((button) => button?.addEventListener("click", openAccount));

    $("#loginTab").addEventListener("click", () => setAuthMode("login"));
    $("#registerTab").addEventListener("click", () => setAuthMode("register"));
    $("#authForm").addEventListener("submit", handleAuthSubmit);
    $("#logoutButton").addEventListener("click", logout);
    $("#dashboardButton").addEventListener("click", openDashboard);
    $("#adminButton").addEventListener("click", openAdmin);
    $("#sellForm").addEventListener("submit", handleListingSubmit);
    $("#photoInput").addEventListener("change", (event) => {
      const files = [...event.target.files];
      const error = validatePhotos(files);
      if (error) {
        setMessage($("#sellFormMessage"), error, "error");
        event.target.value = "";
        previewPhotos([]);
      } else {
        setMessage($("#sellFormMessage"));
        previewPhotos(files);
      }
    });
  }

  async function init() {
    renderCategories();
    updateWishlistUI();
    setupDialogControls();
    setupDrawer();
    bindEvents();
    await initializeAuth();
    await fetchApprovedListings();

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("service-worker.js").catch((error) => console.warn("Service worker not registered", error));
    }
  }

  init().catch((error) => {
    console.error(error);
    loadingGrid.hidden = true;
    modeBanner.hidden = false;
    modeBanner.textContent = "The page encountered an error while starting. Check the browser console and make sure all uploaded files are in the same GitHub folder.";
  });
})();
