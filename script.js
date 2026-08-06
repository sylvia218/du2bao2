(() => {
  "use strict";

  const config = window.DU2BAO2_CONFIG || {};
  const categories = ["Bags", "Cameras", "Technology", "Jewelry"];
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
    guestMode: sessionStorage.getItem("du2bao2-guest-mode") === "1",
    authMode: "login",
    wishlist: new Set(JSON.parse(localStorage.getItem("du2bao2-wishlist") || "[]")),
    photoUrls: [],
    sellerDetails: null,
    adminVerified: false,
    adminTab: "listings",
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

  function normalizeCategory(value = "") {
    const category = String(value || "").trim();
    const legacyCategories = {
      "Luxury Bags": "Bags",
      "Watches": "Jewelry",
      "Accessories": "Jewelry",
      "Camera": "Cameras",
      "Cameras & Technology": "Cameras"
    };
    return legacyCategories[category] || category || "Uncategorised";
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
      title_en: row.title_en || "",
      category: normalizeCategory(row.category),
      price: Number(row.price || 0),
      condition: row.condition || "Good",
      location: row.location || "Malaysia",
      description: row.description || "",
      description_en: row.description_en || "",
      payment_methods: row.payment_methods || "",
      delivery_estimate: row.delivery_estimate || "",
      sale_terms: row.sale_terms || "",
      certification_info: row.certification_info || "",
      badge: row.badge || "Listing reviewed",
      status: row.status || "pending",
      visual: row.visual || (row.brand || "DU").slice(0, 2).toUpperCase(),
      created_at: row.created_at || new Date().toISOString(),
      seller_id: row.seller_id,
      seller_name: profile?.display_name || row.seller_name || "DU2BAO2 Seller",
      seller_whatsapp: profile?.public_phone || profile?.whatsapp || row.seller_whatsapp || "",
      seller_email: profile?.public_email || "",
      seller_address: profile?.public_address || "",
      seller_website: profile?.website_url || "",
      seller_type: profile?.seller_type || "individual",
      seller_business_name: profile?.business_name || "",
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
        .select("*, listing_images(image_url, sort_order), profiles(display_name, whatsapp, public_phone, public_email, public_address, website_url, seller_type, business_name, is_verified)")
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
      const supportedCategory = categories.includes(product.category);
      const categoryMatch = state.activeCategory === "All" || product.category === state.activeCategory;
      const conditionMatch = condition === "All" || product.condition === condition;
      const searchable = `${product.brand} ${product.title} ${product.location} ${product.category}`.toLowerCase();
      return supportedCategory && categoryMatch && conditionMatch && searchable.includes(query);
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
    listingSummary.textContent = `${items.length} listing${items.length === 1 ? "" : "s"} shown`;
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
      Bags: "▱",
      Cameras: "◉",
      Technology: "⌘",
      Jewelry: "◇"
    };
    const labels = {};

    $("#categoryButtons").innerHTML = ["All", ...categories].map((category) => `
      <button class="category ${category === "All" ? "active" : ""}" data-category="${escapeHTML(category)}">
        <span>${icons[category] || "•"}</span>${escapeHTML(labels[category] || category)}
      </button>`).join("");

    $("#sellCategory").innerHTML = categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(labels[category] || category)}</option>`).join("");

    $$(".category").forEach((button) => button.addEventListener("click", () => {
      setActiveCategory(button.dataset.category);
    }));
  }

  function setActiveCategory(category, query = "") {
    state.activeCategory = category || "All";
    $$(".category").forEach((button) => button.classList.toggle("active", button.dataset.category === state.activeCategory));
    if (query) searchInput.value = query;
    renderProducts();
  }

  function setupMarketplaceShortcuts() {
    $$('[data-quick-search]').forEach((button) => button.addEventListener("click", () => {
      searchInput.value = button.dataset.quickSearch || "";
      setActiveCategory("All");
      document.querySelector("#browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
      searchInput.focus({ preventScroll: true });
    }));

    $$('[data-category-jump]').forEach((button) => button.addEventListener("click", () => {
      searchInput.value = button.dataset.categorySearch || "";
      setActiveCategory(button.dataset.categoryJump || "All");
      document.querySelector("#browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function isGuestUser() {
    return Boolean(state.guestMode || state.currentUser?.is_anonymous);
  }

  function isAdmin() {
    if (isGuestUser()) return false;
    if (state.adminVerified) return true;
    const email = state.currentUser?.email?.toLowerCase();
    return Boolean(email && (config.ADMIN_EMAILS || []).some((item) => item.toLowerCase() === email));
  }

  function userDisplayName() {
    if (isGuestUser()) return "Guest";
    return state.currentUser?.user_metadata?.display_name
      || state.currentUser?.user_metadata?.full_name
      || state.currentUser?.user_metadata?.name
      || state.currentUser?.display_name
      || state.currentUser?.email?.split("@")[0]
      || "Seller";
  }

  function updateAccountUI() {
    const guest = isGuestUser();
    const loggedIn = Boolean(state.currentUser) || guest;
    const label = guest ? "Guest" : (loggedIn ? userDisplayName() : "Log in");
    [$("#accountButton"), $("#mobileAccountButton"), $("#footerAccountButton"), $("#bottomAccountButton")].forEach((button) => {
      if (button) button.textContent = label;
    });
    $("#signedOutPanel").hidden = loggedIn;
    $("#signedInPanel").hidden = !loggedIn;
    if (loggedIn) {
      $("#accountName").textContent = guest ? "Hello, Guest" : `Hello, ${userDisplayName()}`;
      $("#accountEmail").textContent = guest
        ? "Guest browsing mode. You can browse and save listings, but you need a Google or email account to sell."
        : (state.currentUser.email || "Signed-in account");
      $("#sellerDetailsButton").hidden = guest;
      $("#dashboardButton").hidden = guest;
      $("#adminButton").hidden = guest || !isAdmin();
      $("#guestUpgradeButton").hidden = !guest;
      $("#logoutButton").textContent = guest ? "Exit guest mode" : "Log out";
    }
  }

  function clearGuestMode() {
    state.guestMode = false;
    sessionStorage.removeItem("du2bao2-guest-mode");
  }


  function getDemoSellerDetails() {
    return JSON.parse(localStorage.getItem("du2bao2-demo-seller-details") || "null");
  }

  function saveDemoSellerDetails(details) {
    localStorage.setItem("du2bao2-demo-seller-details", JSON.stringify(details));
  }

  function sellerDetailsComplete(details) {
    return Boolean(
      details &&
      details.display_name &&
      details.public_email &&
      details.public_phone &&
      details.public_address &&
      details.legal_name &&
      details.private_phone &&
      details.state &&
      details.country &&
      details.declaration_accepted
    );
  }

  async function refreshAdminStatus() {
    state.adminVerified = false;
    if (!state.currentUser || isGuestUser()) return;
    if (!supabaseClient) {
      const email = state.currentUser?.email?.toLowerCase();
      state.adminVerified = Boolean(email && (config.ADMIN_EMAILS || []).some((item) => item.toLowerCase() === email));
      return;
    }
    const { data, error } = await supabaseClient
      .from("admins")
      .select("user_id")
      .eq("user_id", state.currentUser.id)
      .maybeSingle();
    if (!error && data) state.adminVerified = true;
  }

  async function getSellerDetails(force = false) {
    if (!state.currentUser || isGuestUser()) return null;
    if (!force && state.sellerDetails) return state.sellerDetails;

    if (!supabaseClient) {
      state.sellerDetails = getDemoSellerDetails();
      return state.sellerDetails;
    }

    const [{ data: publicData, error: publicError }, { data: privateData, error: privateError }] = await Promise.all([
      supabaseClient
        .from("profiles")
        .select("display_name, seller_type, public_email, public_phone, public_address, website_url, business_name")
        .eq("id", state.currentUser.id)
        .maybeSingle(),
      supabaseClient
        .from("seller_private_profiles")
        .select("legal_name, private_phone, state, country, business_registration_no, identity_reference_last4, declaration_accepted, declaration_at")
        .eq("user_id", state.currentUser.id)
        .maybeSingle()
    ]);

    if (publicError) throw publicError;
    if (privateError) throw privateError;
    state.sellerDetails = { ...(publicData || {}), ...(privateData || {}) };
    return state.sellerDetails;
  }

  function fillSellerDetailsForm(details = {}) {
    const form = $("#sellerDetailsForm");
    const values = {
      display_name: details.display_name || userDisplayName(),
      seller_type: details.seller_type || "individual",
      public_email: details.public_email || state.currentUser?.email || "",
      public_phone: details.public_phone || "",
      public_address: details.public_address || "",
      website_url: details.website_url || "",
      business_name: details.business_name || "",
      legal_name: details.legal_name || state.currentUser?.user_metadata?.full_name || "",
      private_phone: details.private_phone || details.public_phone || "",
      state: details.state || "",
      country: details.country || "Malaysia",
      business_registration_no: details.business_registration_no || "",
      identity_reference_last4: details.identity_reference_last4 || ""
    };
    Object.entries(values).forEach(([name, value]) => {
      if (form.elements[name]) form.elements[name].value = value;
    });
    form.elements.seller_declaration.checked = Boolean(details.declaration_accepted);
  }

  async function openSellerDetails(options = {}) {
    if (!state.currentUser || isGuestUser()) {
      requireAccount(() => openSellerDetails(options));
      return;
    }
    closeDialog("authDialog");
    try {
      const details = await getSellerDetails(Boolean(options.force));
      fillSellerDetailsForm(details || {});
      setMessage(
        $("#sellerDetailsMessage"),
        options.required ? "Complete these details before creating a listing." : "",
        options.required ? "error" : ""
      );
      openDialog("sellerDetailsDialog");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Unable to load seller details");
    }
  }

  async function handleSellerDetailsSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const button = $("#saveSellerDetailsButton");
    const message = $("#sellerDetailsMessage");
    const publicPhone = normalizePhone(formData.get("public_phone") || "");
    const privatePhone = normalizePhone(formData.get("private_phone") || "");
    const idLast4 = String(formData.get("identity_reference_last4") || "").trim();

    if (idLast4 && !/^[A-Za-z0-9]{4}$/.test(idLast4)) {
      setMessage(message, "The optional ID reference must contain exactly 4 letters or numbers.", "error");
      return;
    }

    button.disabled = true;
    setMessage(message, "Saving seller details…");

    const publicPayload = {
      id: state.currentUser.id,
      display_name: String(formData.get("display_name") || "").trim(),
      seller_type: String(formData.get("seller_type") || "individual"),
      public_email: String(formData.get("public_email") || "").trim().toLowerCase(),
      public_phone: publicPhone,
      whatsapp: publicPhone,
      public_address: String(formData.get("public_address") || "").trim(),
      website_url: String(formData.get("website_url") || "").trim(),
      business_name: String(formData.get("business_name") || "").trim()
    };

    const privatePayload = {
      user_id: state.currentUser.id,
      legal_name: String(formData.get("legal_name") || "").trim(),
      private_phone: privatePhone,
      state: String(formData.get("state") || "").trim(),
      country: String(formData.get("country") || "Malaysia").trim(),
      business_registration_no: String(formData.get("business_registration_no") || "").trim(),
      identity_reference_last4: idLast4,
      declaration_accepted: Boolean(formData.get("seller_declaration")),
      declaration_version: "seller-declaration-v1",
      declaration_at: new Date().toISOString()
    };

    try {
      if (!supabaseClient) {
        state.sellerDetails = { ...publicPayload, ...privatePayload };
        saveDemoSellerDetails(state.sellerDetails);
      } else {
        const { error: profileError } = await supabaseClient
          .from("profiles")
          .upsert(publicPayload, { onConflict: "id" });
        if (profileError) throw profileError;

        const { error: privateError } = await supabaseClient
          .from("seller_private_profiles")
          .upsert(privatePayload, { onConflict: "user_id" });
        if (privateError) throw privateError;
        state.sellerDetails = { ...publicPayload, ...privatePayload };
      }

      setMessage(message, "Seller details saved.", "success");
      showToast("Seller details saved");
      setTimeout(() => closeDialog("sellerDetailsDialog"), 650);
    } catch (error) {
      console.error(error);
      setMessage(message, error.message || "Unable to save seller details.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function initializeAuth() {
    if (!supabaseClient) {
      state.currentUser = getDemoUser();
      if (state.currentUser) clearGuestMode();
      await refreshAdminStatus();
      updateAccountUI();
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    state.currentUser = data.session?.user || null;
    if (state.currentUser) clearGuestMode();
    await refreshAdminStatus();
    updateAccountUI();

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.currentUser = session?.user || null;
      state.sellerDetails = null;
      if (state.currentUser) clearGuestMode();
      await refreshAdminStatus();
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

  function authRedirectUrl() {
    const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (localHost) return `${window.location.origin}${window.location.pathname}`;
    return String(config.SITE_URL || `${window.location.origin}${window.location.pathname}`).replace(/\/$/, "");
  }

  async function handleGoogleLogin() {
    const button = $("#googleLoginButton");
    button.disabled = true;
    setMessage($("#authMessage"), "Opening Google sign-in…");

    try {
      if (!supabaseClient) {
        throw new Error("Connect Supabase and enable the Google provider before using Google login.");
      }
      clearGuestMode();
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirectUrl() }
      });
      if (error) throw error;
    } catch (error) {
      console.error(error);
      setMessage($("#authMessage"), error.message || "Google login could not be started.", "error");
      button.disabled = false;
    }
  }

  function handleGuestLogin() {
    state.currentUser = null;
    state.guestMode = true;
    sessionStorage.setItem("du2bao2-guest-mode", "1");
    updateAccountUI();
    closeDialog("authDialog");
    showToast("Browsing as guest");
  }

  function upgradeGuestAccount() {
    clearGuestMode();
    updateAccountUI();
    setAuthMode("register");
    setMessage($("#authMessage"), "Create an account or continue with Google to start selling.");
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
      clearGuestMode();
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
    const wasGuest = isGuestUser();
    if (wasGuest && state.currentUser?.is_anonymous && supabaseClient) {
      await supabaseClient.auth.signOut();
    } else if (!wasGuest && supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    clearGuestMode();
    localStorage.removeItem("du2bao2-demo-user");
    state.currentUser = null;
    updateAccountUI();
    closeDialog("authDialog");
    showToast(wasGuest ? "Guest mode closed" : "Logged out");
  }

  function requireAccount(action) {
    if (state.currentUser && !isGuestUser()) {
      action();
      return;
    }
    if (isGuestUser()) {
      clearGuestMode();
      updateAccountUI();
      setAuthMode("register");
      setMessage($("#authMessage"), "Guest mode is for browsing only. Create an account or continue with Google to sell.");
      openDialog("authDialog");
      showToast("A full account is required to sell");
      return;
    }
    setAuthMode("login");
    openDialog("authDialog");
    showToast("Log in, use Google, or continue as guest");
  }

  function validatePhotos(files) {
    if (files.length < 2) return "Please upload at least 2 actual-item photos.";
    if (files.length > 8) return "Please choose no more than 8 photos.";
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

    const sellerDetails = await getSellerDetails();
    if (!sellerDetailsComplete(sellerDetails)) {
      setMessage(message, "Complete your seller details before submitting a listing.", "error");
      closeDialog("sellDialog");
      await openSellerDetails({ required: true });
      return;
    }

    submitButton.disabled = true;
    setMessage(message, "Saving your listing…");

    const selectedCategory = String(formData.get("category") || "").trim();

    const payload = {
      seller_id: state.currentUser?.id,
      title: String(formData.get("title") || "").trim(),
      title_en: String(formData.get("title_en") || "").trim(),
      brand: String(formData.get("brand") || "").trim(),
      category: categories.includes(selectedCategory) ? selectedCategory : "Bags",
      price: Number(formData.get("price")),
      condition: String(formData.get("condition") || "Good"),
      location: String(formData.get("location") || "Malaysia").trim(),
      description: String(formData.get("description") || "").trim(),
      description_en: String(formData.get("description_en") || "").trim(),
      payment_methods: String(formData.get("payment_methods") || "").trim(),
      delivery_estimate: String(formData.get("delivery_estimate") || "").trim(),
      sale_terms: String(formData.get("sale_terms") || "").trim(),
      certification_info: String(formData.get("certification_info") || "").trim(),
      seller_declaration_at: new Date().toISOString(),
      status: "pending"
    };

    try {
      if (!supabaseClient) {
        const listings = getDemoListings();
        listings.unshift({
          ...payload,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
          seller_name: sellerDetails.display_name || userDisplayName(),
          seller_whatsapp: sellerDetails.public_phone || config.WHATSAPP_NUMBER,
          seller_email: sellerDetails.public_email || "",
          seller_address: sellerDetails.public_address || "",
          seller_website: sellerDetails.website_url || "",
          seller_type: sellerDetails.seller_type || "individual",
          seller_business_name: sellerDetails.business_name || "",
          seller_verified: false,
          badge: "Pending review",
          visual: payload.brand.slice(0, 2).toUpperCase(),
          images: state.photoUrls
        });
        saveDemoListings(listings);
      } else {
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
      .select("*, listing_images(image_url, sort_order), profiles(display_name, whatsapp, public_phone, public_email, public_address, website_url, seller_type, business_name, is_verified)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizeListing);
  }

  async function getReports() {
    if (!supabaseClient) {
      return JSON.parse(localStorage.getItem("du2bao2-demo-reports") || "[]")
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    const { data, error } = await supabaseClient
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getSellerRecords() {
    if (!supabaseClient) {
      const details = getDemoSellerDetails();
      return details ? [{ user_id: state.currentUser.id, ...details }] : [];
    }
    const { data, error } = await supabaseClient
      .from("seller_private_profiles")
      .select("user_id, legal_name, private_phone, state, country, business_registration_no, declaration_accepted, declaration_at, retention_until, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  function reportReasonLabel(reason) {
    const labels = {
      suspected_counterfeit: "Suspected counterfeit",
      misleading_information: "Misleading information",
      prohibited_item: "Prohibited or unsafe item",
      scam_concern: "Scam or payment concern",
      seller_conduct: "Seller conduct",
      other: "Other"
    };
    return labels[reason] || reason || "Report";
  }

  async function renderAdminTab(tab = state.adminTab) {
    state.adminTab = tab;
    $$("[data-admin-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === tab));
    $("#adminList").innerHTML = "<p class=\"empty-mini\">Loading…</p>";

    try {
      if (tab === "listings") {
        const listings = await getPendingListings();
        $("#adminList").innerHTML = listings.length ? listings.map((item) => `
          <article class="mini-card">
            <div class="mini-image">${item.images?.[0] ? `<img src="${escapeHTML(item.images[0])}" alt="" />` : escapeHTML(item.visual || item.brand?.slice(0, 2) || "DU")}</div>
            <div class="mini-copy"><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.brand)} · ${money.format(item.price)} · ${escapeHTML(item.seller_name || "Seller")}</span>${statusPill(item.status)}</div>
            <div class="mini-actions"><button class="approve" data-admin-action="approved" data-id="${escapeHTML(item.id)}">Approve</button><button class="reject" data-admin-action="rejected" data-id="${escapeHTML(item.id)}">Reject</button></div>
          </article>`).join("") : "<p class=\"empty-mini\">There are no listings waiting for approval.</p>";
        $$("[data-admin-action]").forEach((button) => button.addEventListener("click", () => moderateListing(button.dataset.id, button.dataset.adminAction)));
        return;
      }

      if (tab === "reports") {
        const reports = await getReports();
        $("#adminList").innerHTML = reports.length ? reports.map((report) => `
          <article class="admin-record-card">
            <div>
              <div class="record-heading"><strong>${escapeHTML(reportReasonLabel(report.reason))}</strong>${statusPill(report.status || "open")}</div>
              <span class="record-meta">${escapeHTML(report.listing_title_snapshot || "Listing unavailable")} · ${new Date(report.created_at).toLocaleString("en-MY")}</span>
              <p>${escapeHTML(report.details || "")}</p>
              <span class="record-meta">Reporter: ${escapeHTML(report.reporter_name || "Not supplied")} · ${escapeHTML(report.reporter_email || "No email")}</span>
              ${report.evidence_url ? `<a class="record-link" href="${escapeHTML(report.evidence_url)}" target="_blank" rel="noopener">Open evidence link</a>` : ""}
            </div>
            <div class="record-actions">
              <button data-report-status="reviewing" data-report-id="${escapeHTML(report.id)}">Reviewing</button>
              <button data-report-status="resolved" data-report-id="${escapeHTML(report.id)}">Resolve</button>
              <button data-report-status="dismissed" data-report-id="${escapeHTML(report.id)}">Dismiss</button>
            </div>
          </article>`).join("") : "<p class=\"empty-mini\">No reports have been submitted.</p>";
        $$("[data-report-status]").forEach((button) => button.addEventListener("click", () => updateReportStatus(button.dataset.reportId, button.dataset.reportStatus)));
        return;
      }

      const records = await getSellerRecords();
      $("#adminList").innerHTML = records.length ? records.map((record) => `
        <article class="admin-record-card private-record-card">
          <div>
            <div class="record-heading"><strong>${escapeHTML(record.legal_name || "Unnamed seller")}</strong><span class="status-pill ${record.declaration_accepted ? "status-approved" : "status-pending"}">${record.declaration_accepted ? "Declared" : "Incomplete"}</span></div>
            <span class="record-meta">${escapeHTML(record.private_phone || "No private phone")} · ${escapeHTML(record.state || "")}, ${escapeHTML(record.country || "")}</span>
            <p>Business registration: ${escapeHTML(record.business_registration_no || "Not supplied")}</p>
            <span class="record-meta">Declaration: ${record.declaration_at ? new Date(record.declaration_at).toLocaleString("en-MY") : "Not recorded"} · Retention review: ${record.retention_until ? new Date(record.retention_until).toLocaleDateString("en-MY") : "Not set"}</span>
          </div>
        </article>`).join("") : "<p class=\"empty-mini\">No private seller records are available.</p>";
    } catch (error) {
      console.error(error);
      $("#adminList").innerHTML = `<p class="empty-mini">${escapeHTML(error.message || "Unable to load admin records.")}</p>`;
    }
  }

  async function openAdmin() {
    if (!isAdmin()) {
      showToast("This account does not have admin access.");
      return;
    }
    closeDialog("authDialog");
    openDialog("adminDialog");
    await renderAdminTab(state.adminTab);
  }

  async function moderateListing(id, status) {
    try {
      if (!supabaseClient) {
        const listings = getDemoListings();
        const target = listings.find((item) => String(item.id) === String(id));
        if (target) {
          target.status = status;
          target.badge = status === "approved" ? "Listing reviewed" : "Rejected";
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
      await renderAdminTab("listings");
      await fetchApprovedListings();
    } catch (error) {
      showToast(error.message || "Unable to update approval");
    }
  }

  async function updateReportStatus(id, status) {
    try {
      if (!supabaseClient) {
        const reports = JSON.parse(localStorage.getItem("du2bao2-demo-reports") || "[]");
        const target = reports.find((item) => String(item.id) === String(id));
        if (target) {
          target.status = status;
          target.handled_at = new Date().toISOString();
        }
        localStorage.setItem("du2bao2-demo-reports", JSON.stringify(reports));
      } else {
        const { error } = await supabaseClient
          .from("reports")
          .update({
            status,
            handled_by: state.currentUser.id,
            handled_at: new Date().toISOString()
          })
          .eq("id", id);
        if (error) throw error;
      }
      showToast("Report status updated");
      await renderAdminTab("reports");
    } catch (error) {
      showToast(error.message || "Unable to update report");
    }
  }

  function openAccount() {
    updateAccountUI();
    openDialog("authDialog");
  }

  function openSellForm() {
    requireAccount(async () => {
      try {
        const details = await getSellerDetails();
        if (!sellerDetailsComplete(details)) {
          await openSellerDetails({ required: true });
          showToast("Complete seller details before listing");
          return;
        }
        setMessage($("#sellFormMessage"));
        openDialog("sellDialog");
      } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to open the listing form");
      }
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

    $("#googleLoginButton").addEventListener("click", handleGoogleLogin);
    $("#guestLoginButton").addEventListener("click", handleGuestLogin);
    $("#guestUpgradeButton").addEventListener("click", upgradeGuestAccount);
    $("#loginTab").addEventListener("click", () => setAuthMode("login"));
    $("#registerTab").addEventListener("click", () => setAuthMode("register"));
    $("#authForm").addEventListener("submit", handleAuthSubmit);
    $("#logoutButton").addEventListener("click", logout);
    $("#sellerDetailsButton").addEventListener("click", () => openSellerDetails());
    $("#dashboardButton").addEventListener("click", openDashboard);
    $("#adminButton").addEventListener("click", openAdmin);
    $("#sellerDetailsForm").addEventListener("submit", handleSellerDetailsSubmit);
    $$("[data-admin-tab]").forEach((button) => button.addEventListener("click", () => renderAdminTab(button.dataset.adminTab)));
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
    setupMarketplaceShortcuts();
    updateWishlistUI();
    setupDialogControls();
    setupDrawer();
    bindEvents();
    await initializeAuth();
    await fetchApprovedListings();

    const requestedAction = new URLSearchParams(window.location.search).get("action");
    if (requestedAction === "sell") {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash || ""}`);
      await openSellForm();
    }

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
