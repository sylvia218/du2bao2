(() => {
  "use strict";
  const button = document.getElementById("mobileMenuButton");
  const drawer = document.getElementById("mobileDrawer");
  const overlay = document.getElementById("drawerOverlay");
  const closeButton = document.getElementById("drawerClose");
  if (!button || !drawer || !overlay || !closeButton) return;

  const openMenu = () => {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
    closeButton.focus();
  };

  const closeMenu = () => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  };

  button.addEventListener("click", openMenu);
  closeButton.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);
  drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("open")) {
      closeMenu();
      button.focus();
    }
  });
})();
