(() => {
  "use strict";

  const config = window.DU2BAO2_CONFIG || {};
  const demoProducts = window.DU2BAO2_DEMO_PRODUCTS || [];
  const hasSupabaseConfig = Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
  const client = hasSupabaseConfig && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;
  const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });
  const wishlist = new Set(JSON.parse(localStorage.getItem("du2bao2-wishlist") || "[]"));
  let currentProduct = null;
  let allProducts = [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function normalizeListing(row) {
    const imageRows = Array.isArray(row.listing_images) ? row.listing_images : [];
    const images = imageRows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((item) => item.image_url).filter(Boolean);
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
      seller_name: profile?.display_name || row.seller_name || "DU2BAO2 Seller",
      seller_whatsapp: profile?.whatsapp || row.seller_whatsapp || "",
      seller_verified: Boolean(profile?.is_verified || row.seller_verified),
      images
    };
  }

  function getLocalProducts() {
    const local = JSON.parse(localStorage.getItem("du2bao2-demo-listings") || "[]").filter((item) => item.status === "approved");
    return [...local, ...demoProducts];
  }

  async function loadProducts() {
    if (!client) {
      allProducts = getLocalProducts();
      return;
    }
    const { data, error } = await client
      .from("listings")
      .select("*, listing_images(image_url, sort_order), profiles(display_name, whatsapp, is_verified)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) throw error;
    allProducts = (data || []).map(normalizeListing);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function renderGallery(product) {
    const images = product.images || [];
    if (!images.length) {
      return `<div><div class="gallery-main" id="galleryMain">${escapeHTML(product.visual || product.brand.slice(0, 2))}</div></div>`;
    }
    return `
      <div>
        <div class="gallery-main" id="galleryMain"><img src="${escapeHTML(images[0])}" alt="${escapeHTML(product.title)}" /></div>
        ${images.length > 1 ? `<div class="gallery-thumbs">${images.map((url, index) => `<button class="gallery-thumb ${index === 0 ? "active" : ""}" data-image="${escapeHTML(url)}"><img src="${escapeHTML(url)}" alt="View ${index + 1}" /></button>`).join("")}</div>` : ""}
      </div>`;
  }

  function contactLink(product) {
    const number = String(product.seller_whatsapp || config.WHATSAPP_NUMBER || "").replace(/\D/g, "");
    if (!number) return `<button class="primary-btn" disabled>Seller contact not added</button>`;
    const pageUrl = encodeURIComponent(location.href);
    const text = encodeURIComponent(`Hi, I am interested in ${product.brand} ${product.title} listed on DU2BAO2. ${decodeURIComponent(pageUrl)}`);
    return `<a class="primary-btn" href="https://wa.me/${number}?text=${text}" target="_blank" rel="noopener">Contact seller on WhatsApp</a>`;
  }

  function renderProduct(product) {
    currentProduct = product;
    document.title = `${product.brand} ${product.title} | DU2BAO2`;
    $("#breadcrumbName").textContent = product.title;
    const saved = wishlist.has(String(product.id));
    $("#productDetail").innerHTML = `
      ${renderGallery(product)}
      <div class="detail-copy">
        <span class="brand-name">${escapeHTML(product.brand)}</span>
        <h1>${escapeHTML(product.title)}</h1>
        <span class="badge" style="position:static;display:inline-flex">${escapeHTML(product.badge || "Approved")}</span>
        <div class="detail-price">${money.format(product.price)}</div>
        <div class="detail-meta">
          <div><strong>${escapeHTML(product.condition)}</strong><span>Condition</span></div>
          <div><strong>${escapeHTML(product.category)}</strong><span>Category</span></div>
          <div><strong>${escapeHTML(product.location)}</strong><span>Location</span></div>
          <div><strong>${product.seller_verified ? "Verified seller" : "Registered seller"}</strong><span>Seller status</span></div>
        </div>
        <p class="detail-description">${escapeHTML(product.description || "No additional description was provided.")}</p>
        <div class="seller-box"><strong>${escapeHTML(product.seller_name || "DU2BAO2 Seller")}${product.seller_verified ? " ✓" : ""}</strong><span>Contact the seller to confirm availability, payment and delivery arrangements.</span></div>
        <div class="detail-actions">
          ${contactLink(product)}
          <button class="secondary-btn" id="saveProductButton">${saved ? "♥ Saved to wishlist" : "♡ Save to wishlist"}</button>
          <button class="secondary-btn" id="shareProductButton">Share this listing</button>
        </div>
      </div>`;

    $("#detailLoading").hidden = true;
    $("#productDetail").hidden = false;
    bindDetailEvents();
    renderRelated();
  }

  function bindDetailEvents() {
    $$('[data-image]').forEach((button) => button.addEventListener("click", () => {
      $$(".gallery-thumb").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $("#galleryMain").innerHTML = `<img src="${escapeHTML(button.dataset.image)}" alt="${escapeHTML(currentProduct.title)}" />`;
    }));

    $("#saveProductButton").addEventListener("click", () => {
      const key = String(currentProduct.id);
      if (wishlist.has(key)) wishlist.delete(key); else wishlist.add(key);
      localStorage.setItem("du2bao2-wishlist", JSON.stringify([...wishlist]));
      $("#saveProductButton").textContent = wishlist.has(key) ? "♥ Saved to wishlist" : "♡ Save to wishlist";
      showToast(wishlist.has(key) ? "Saved to wishlist" : "Removed from wishlist");
    });

    $("#shareProductButton").addEventListener("click", async () => {
      const shareData = { title: `${currentProduct.brand} ${currentProduct.title}`, text: `See this listing on DU2BAO2`, url: location.href };
      try {
        if (navigator.share) await navigator.share(shareData);
        else {
          await navigator.clipboard.writeText(location.href);
          showToast("Listing link copied");
        }
      } catch (error) {
        if (error.name !== "AbortError") showToast("Unable to share this listing");
      }
    });
  }

  function card(product) {
    const image = product.images?.[0]
      ? `<img src="${escapeHTML(product.images[0])}" alt="${escapeHTML(product.title)}" loading="lazy" />`
      : `<div class="visual">${escapeHTML(product.visual || product.brand.slice(0, 2))}</div>`;
    return `<article class="product-card"><a class="product-link" href="product.html?id=${encodeURIComponent(product.id)}"><div class="product-image"><span class="badge">${escapeHTML(product.badge || "Approved")}</span>${image}</div><div class="product-copy"><span class="brand-name">${escapeHTML(product.brand)}</span><h3>${escapeHTML(product.title)}</h3><div class="price-line"><span class="price">${money.format(product.price)}</span><span class="condition">${escapeHTML(product.condition)}</span></div></div></a></article>`;
  }

  function renderRelated() {
    const related = allProducts.filter((item) => String(item.id) !== String(currentProduct.id) && item.category === currentProduct.category).slice(0, 4);
    if (!related.length) return;
    $("#relatedGrid").innerHTML = related.map(card).join("");
    $("#relatedSection").hidden = false;
  }

  function renderNotFound() {
    $("#detailLoading").hidden = true;
    $("#productDetail").hidden = false;
    $("#productDetail").innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span>⌕</span><h3>Listing not found</h3><p>This product may still be pending, may have been sold, or the link may be incorrect.</p><a class="primary-btn" href="index.html#browse">Return to marketplace</a></div>`;
  }

  async function init() {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
      renderNotFound();
      return;
    }
    try {
      await loadProducts();
      const product = allProducts.find((item) => String(item.id) === String(id));
      if (!product) renderNotFound(); else renderProduct(product);
    } catch (error) {
      console.error(error);
      allProducts = getLocalProducts();
      const fallback = allProducts.find((item) => String(item.id) === String(id));
      if (fallback) renderProduct(fallback); else renderNotFound();
    }
  }

  init();
})();
