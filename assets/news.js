// Homepage "Show all of YYYY" news toggle — progressive enhancement.
// The extra entries and the button are rendered [hidden]; if this script never
// runs, the latest entries and the "All news" link still show.
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector(".news-toggle");
    if (!btn) return;
    var extra = document.getElementById(btn.getAttribute("aria-controls"));
    if (!extra) return;
    btn.hidden = false;

    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      extra.hidden = !open;
      btn.textContent = btn.getAttribute(open ? "data-less" : "data-more");
    });
  });
})();
