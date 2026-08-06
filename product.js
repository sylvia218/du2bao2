(() => {
  "use strict";

  const config = window.DU2BAO2_CONFIG || {};
  const demoProducts = window.DU2BAO2_DEMO_PRODUCTS || [];
  const hasSupabaseConfig = Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
  const client = hasSupabaseConfig && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;
  const money = new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0
  });
  const wishlist = new Set(JSON.parse(localStorage.getItem("du2bao2-wishlist") || "[]"));

  let currentProduct = null;
  let allProducts = [];
  let contactIntent = "question";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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
    let digits = String(value).replace(/\D/g, "");
    if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
    return digits;
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

  function normalizeListing(row) {
    const imageRows = Array.isArray(row.listing_images) ? [...row.listing_images] : [];
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
      seller_id: row.seller_id || row.seller_id_snapshot || "",
      seller_name: profile?.display_name || row.seller_name || "DU2BAO2 Seller",
      seller_type: profile?.seller_type || row.seller_type || "individual",
      seller_business_name: profile?.business_name || row.seller_business_name || "",
      seller_whatsapp: profile?.public_phone || profile?.whatsapp || row.seller_whatsapp || "",
      seller_email: profile?.public_email || row.seller_email || "",
      seller_address: profile?.public_address || row.seller_address || "",
      seller_website: profile?.website_url || row.seller_website || "",
      seller_verified: Boolean(profile?.is_verified || row.seller_verified),
      images,
      created_at: row.created_at || new Date().toISOString()
    };
  }

  function getLocalProducts() {
    const local = JSON.parse(localStorage.getItem("du2bao2-demo-listings") || "[]")
      .filter((item) => item.status === "approved")
      .map(normalizeListing);
    return [...local, ...demoProducts.map(normalizeListing)];
  }

  async function loadProducts() {
    if (!client) {
      allProducts = getLocalProducts();
      return;
    }

    const { data, error } = await client
      .from("listings")
      .select("*, listing_images(image_url, sort_order), profiles(display_name, whatsapp, public_phone, public_email, public_address, website_url, seller_type, business_name, is_verified)")
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

  function setMessage(element, text = "", type = "") {
    if (!element) return;
    element.textContent = text;
    element.className = `form-message${type ? ` ${type}` : ""}`;
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function setupDialogControls() {
    $$('[data-close-dialog]').forEach((button) => {
      button.addEventListener("click", () => closeDialog(button.dataset.closeDialog));
    });
    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog.id);
      });
    });
  }

  function renderGallery(product) {
    const images = product.images || [];
    if (!images.length) {
      return `<div><div class="gallery-main" id="galleryMain">${escapeHTML(product.visual || product.brand.slice(0, 2))}</div></div>`;
    }

    return `
      <div>
        <div class="gallery-main" id="galleryMain"><img src="${escapeHTML(images[0])}" alt="${escapeHTML(product.title)}" /></div>
        ${images.length > 1 ? `<div class="gallery-thumbs">${images.map((url, index) => `
          <button class="gallery-thumb ${index === 0 ? "active" : ""}" data-image="${escapeHTML(url)}" type="button">
            <img src="${escapeHTML(url)}" alt="Product view ${index + 1}" />
          </button>`).join("")}</div>` : ""}
      </div>`;
  }

  function infoItem(label, value) {
    if (!value) return "";
    return `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
  }

  function safeExternalLink(url) {
    const value = String(url || "").trim();
    if (!/^https?:\/\//i.test(value)) return "";
    return value;
  }

  function renderProduct(product) {
    currentProduct = product;
    document.title = `${product.brand} ${product.title} | DU2BAO2`;
    $("#breadcrumbName").textContent = product.title;
    const saved = wishlist.has(String(product.id));
    const sellerWebsite = safeExternalLink(product.seller_website);

    $("#productDetail").innerHTML = `
      ${renderGallery(product)}
      <div class="detail-copy">
        <span class="brand-name">${escapeHTML(product.brand)}</span>
        <h1>${escapeHTML(product.title)}</h1>
        ${product.title_en ? `<p class="english-title">${escapeHTML(product.title_en)}</p>` : ""}
        <span class="badge static-badge">${escapeHTML(product.badge || "Listing reviewed")}</span>
        <div class="detail-price">${money.format(product.price)}</div>

        <div class="detail-meta">
          <div><strong>${escapeHTML(product.condition)}</strong><span>Condition</span></div>
          <div><strong>${escapeHTML(product.category)}</strong><span>Category</span></div>
          <div><strong>${escapeHTML(product.location)}</strong><span>Location</span></div>
          <div><strong>${escapeHTML(product.seller_type === "business" ? "Business seller" : "Individual seller")}</strong><span>Seller type</span></div>
        </div>

        <section class="detail-information-section">
          <h2 class="detail-section-title">Product description</h2>
          <p class="detail-description">${escapeHTML(product.description || "No additional description was provided.")}</p>
          ${product.description_en ? `<div class="bilingual-description"><strong>English version</strong><p>${escapeHTML(product.description_en)}</p></div>` : ""}
        </section>

        <section class="detail-information-section">
          <h2 class="detail-section-title">Transaction information</h2>
          <div class="transaction-info-grid">
            ${infoItem("Payment methods stated by seller", product.payment_methods || "Not supplied")}
            ${infoItem("Estimated delivery or handover", product.delivery_estimate || "Not supplied")}
            ${infoItem("Seller's sale terms", product.sale_terms || "Not supplied")}
            ${infoItem("Certification information", product.certification_info || "Not supplied")}
          </div>
        </section>

        <section class="seller-box seller-disclosure-box">
          <div>
            <span class="seller-box-label">Seller disclosure</span>
            <strong>${escapeHTML(product.seller_business_name || product.seller_name || "DU2BAO2 Seller")}</strong>
            ${product.seller_business_name && product.seller_name !== product.seller_business_name ? `<span>${escapeHTML(product.seller_name)}</span>` : ""}
          </div>
          <div class="seller-disclosure-grid">
            ${infoItem("Email", product.seller_email || "Not supplied")}
            ${infoItem("Telephone / WhatsApp", product.seller_whatsapp || "Not supplied")}
            ${infoItem("Business or service address", product.seller_address || "Not supplied")}
            ${sellerWebsite ? `<div><span>Website</span><strong><a href="${escapeHTML(sellerWebsite)}" target="_blank" rel="noopener">Visit seller website</a></strong></div>` : infoItem("Website", "Not supplied")}
          </div>
        </section>

        <div class="listing-disclaimer">Listing and seller information is supplied by the seller. DU2BAO2 reviews listings for marketplace moderation but does not currently independently authenticate items or confirm transaction completion. Verify important details before proceeding.</div>

        <div class="detail-actions">
          <button class="primary-btn" id="contactSellerButton" type="button">Contact seller</button>
          <button class="secondary-btn" id="saveProductButton" type="button">${saved ? "♥ Saved to wishlist" : "♡ Save to wishlist"}</button>
          <button class="secondary-btn" id="shareProductButton" type="button">Share this listing</button>
          <button class="report-button" id="reportListingButton" type="button">Report this listing</button>
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

    $("#contactSellerButton")?.addEventListener("click", openContactDialog);
    $("#reportListingButton")?.addEventListener("click", openReportDialog);

    $("#saveProductButton")?.addEventListener("click", () => {
      const key = String(currentProduct.id);
      if (wishlist.has(key)) wishlist.delete(key);
      else wishlist.add(key);
      localStorage.setItem("du2bao2-wishlist", JSON.stringify([...wishlist]));
      $("#saveProductButton").textContent = wishlist.has(key) ? "♥ Saved to wishlist" : "♡ Save to wishlist";
      showToast(wishlist.has(key) ? "Saved to wishlist" : "Removed from wishlist");
    });

    $("#shareProductButton")?.addEventListener("click", async () => {
      const shareData = {
        title: `${currentProduct.brand} ${currentProduct.title}`,
        text: "See this listing on DU2BAO2",
        url: location.href
      };
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

  function setContactIntent(intent) {
    contactIntent = intent;
    $$('[data-contact-intent]').forEach((button) => button.classList.toggle("active", button.dataset.contactIntent === intent));
    const offerLabel = $("#offerAmountLabel");
    const offerInput = offerLabel?.querySelector("input");
    const isOffer = intent === "offer";
    if (offerLabel) offerLabel.hidden = !isOffer;
    if (offerInput) offerInput.required = isOffer;
  }

  function openContactDialog() {
    const number = normalizePhone(currentProduct?.seller_whatsapp || config.WHATSAPP_NUMBER || "");
    const message = $("#contactMessage");
    $("#contactForm").reset();
    setContactIntent("question");
    setMessage(message, number ? "" : "This seller has not added a WhatsApp number.", number ? "" : "error");
    $("#continueWhatsAppButton").disabled = !number;
    openDialog("contactDialog");
  }

  function handleContactSubmit(event) {
    event.preventDefault();
    if (!currentProduct) return;

    const formData = new FormData(event.currentTarget);
    const number = normalizePhone(currentProduct.seller_whatsapp || config.WHATSAPP_NUMBER || "");
    const customMessage = String(formData.get("message") || "").trim();
    const offerAmount = Number(formData.get("offer_amount") || 0);

    if (!number) {
      setMessage($("#contactMessage"), "This seller has not added a WhatsApp number.", "error");
      return;
    }
    if (contactIntent === "offer" && (!offerAmount || offerAmount <= 0)) {
      setMessage($("#contactMessage"), "Enter a valid offer amount.", "error");
      return;
    }

    const productName = `${currentProduct.brand} ${currentProduct.title}`;
    const intro = {
      question: `Hi, I have a question about ${productName} listed on DU2BAO2.`,
      availability: `Hi, is ${productName} still available on DU2BAO2?`,
      offer: `Hi, I would like to offer ${money.format(offerAmount)} for ${productName} listed on DU2BAO2.`
    }[contactIntent];
    const fullMessage = [intro, customMessage, `Listing: ${location.href}`].filter(Boolean).join("\n\n");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(fullMessage)}`, "_blank", "noopener");
    closeDialog("contactDialog");
  }

  async function openReportDialog() {
    const form = $("#reportForm");
    form.reset();
    setMessage($("#reportMessage"));

    if (client) {
      try {
        const { data } = await client.auth.getSession();
        const user = data.session?.user;
        if (user?.email) form.elements.reporter_email.value = user.email;
        if (user?.user_metadata?.full_name || user?.user_metadata?.name) {
          form.elements.reporter_name.value = user.user_metadata.full_name || user.user_metadata.name;
        }
      } catch (error) {
        console.warn("Unable to prefill report details", error);
      }
    }

    openDialog("reportDialog");
  }

  function demoReportId() {
    return `RPT-${Date.now().toString(36).toUpperCase()}`;
  }

  async function handleReportSubmit(event) {
    event.preventDefault();
    if (!currentProduct) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const button = $("#submitReportButton");
    const message = $("#reportMessage");

    if (String(formData.get("website") || "").trim()) {
      setMessage(message, "Unable to submit this report.", "error");
      return;
    }

    button.disabled = true;
    setMessage(message, "Submitting report…");

    try {
      let user = null;
      if (client) {
        const { data } = await client.auth.getSession();
        user = data.session?.user || null;
      }

      const payload = {
        listing_id: String(currentProduct.id).startsWith("demo-") || String(currentProduct.id).startsWith("local-") ? null : currentProduct.id,
        reporter_user_id: user?.id || null,
        reporter_name: String(formData.get("reporter_name") || "").trim(),
        reporter_email: String(formData.get("reporter_email") || "").trim().toLowerCase(),
        reason: String(formData.get("reason") || "other"),
        details: String(formData.get("details") || "").trim(),
        evidence_url: String(formData.get("evidence_url") || "").trim(),
        listing_title_snapshot: `${currentProduct.brand} ${currentProduct.title}`,
        listing_url_snapshot: location.href,
        seller_id_snapshot: currentProduct.seller_id || null,
        status: "open"
      };

      let reference;
      if (!client) {
        const reports = JSON.parse(localStorage.getItem("du2bao2-demo-reports") || "[]");
        reference = demoReportId();
        reports.unshift({
          ...payload,
          id: reference,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          retention_until: new Date(Date.now() + (3 * 365 * 24 * 60 * 60 * 1000)).toISOString()
        });
        localStorage.setItem("du2bao2-demo-reports", JSON.stringify(reports));
      } else {
        const { data, error } = await client.from("reports").insert(payload).select("id").single();
        if (error) throw error;
        reference = data.id;
      }

      setMessage(message, `Report submitted. Reference: ${reference}`, "success");
      showToast("Report submitted for review");
      setTimeout(() => closeDialog("reportDialog"), 1200);
    } catch (error) {
      console.error(error);
      setMessage(message, error.message || "Unable to submit the report. Please try again.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function card(product) {
    const image = product.images?.[0]
      ? `<img src="${escapeHTML(product.images[0])}" alt="${escapeHTML(product.title)}" loading="lazy" />`
      : `<div class="visual">${escapeHTML(product.visual || product.brand.slice(0, 2))}</div>`;
    return `<article class="product-card"><a class="product-link" href="product.html?id=${encodeURIComponent(product.id)}"><div class="product-image"><span class="badge">${escapeHTML(product.badge || "Listing reviewed")}</span>${image}</div><div class="product-copy"><span class="brand-name">${escapeHTML(product.brand)}</span><h3>${escapeHTML(product.title)}</h3><div class="price-line"><span class="price">${money.format(product.price)}</span><span class="condition">${escapeHTML(product.condition)}</span></div></div></a></article>`;
  }

  function renderRelated() {
    const related = allProducts
      .filter((item) => String(item.id) !== String(currentProduct.id) && item.category === currentProduct.category)
      .slice(0, 4);
    if (!related.length) return;
    $("#relatedGrid").innerHTML = related.map(card).join("");
    $("#relatedSection").hidden = false;
  }

  function renderNotFound() {
    $("#detailLoading").hidden = true;
    $("#productDetail").hidden = false;
    $("#productDetail").innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span>⌕</span><h3>Listing not found</h3><p>This product may still be pending, may have been sold, or the link may be incorrect.</p><a class="primary-btn" href="index.html#browse">Return to marketplace</a></div>`;
  }

  function bindStaticEvents() {
    setupDialogControls();
    $$('[data-contact-intent]').forEach((button) => {
      button.addEventListener("click", () => setContactIntent(button.dataset.contactIntent));
    });
    $("#contactForm")?.addEventListener("submit", handleContactSubmit);
    $("#reportForm")?.addEventListener("submit", handleReportSubmit);
  }

  async function init() {
    bindStaticEvents();
    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
      renderNotFound();
      return;
    }

    try {
      await loadProducts();
      const product = allProducts.find((item) => String(item.id) === String(id));
      if (!product) renderNotFound();
      else renderProduct(product);
    } catch (error) {
      console.error(error);
      allProducts = getLocalProducts();
      const fallback = allProducts.find((item) => String(item.id) === String(id));
      if (fallback) renderProduct(fallback);
      else renderNotFound();
    }
  }

  init();
})();
