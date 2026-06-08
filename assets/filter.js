// Publications filter chips — progressive enhancement.
// The .filter-chips bar is rendered with [hidden]; if this script never runs,
// the full year-grouped list shows and no broken UI appears.
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.querySelector(".filter-chips");
    if (!bar) return;
    bar.hidden = false;

    var items = Array.prototype.slice.call(document.querySelectorAll(".pub-item"));
    var headers = Array.prototype.slice.call(document.querySelectorAll(".year-divider"));

    function apply(filter) {
      items.forEach(function (el) {
        var cats = (el.getAttribute("data-cat") || "").split(/\s+/);
        var show = filter === "all" || cats.indexOf(filter) !== -1;
        el.classList.toggle("is-hidden", !show);
      });
      // Hide year headers whose papers are all filtered out.
      headers.forEach(function (h) {
        var n = h.nextElementSibling;
        var visible = false;
        while (n && !n.classList.contains("year-divider")) {
          if (n.classList.contains("pub-item") && !n.classList.contains("is-hidden")) {
            visible = true;
            break;
          }
          n = n.nextElementSibling;
        }
        h.classList.toggle("is-hidden", !visible);
      });
    }

    bar.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-filter]");
      if (!chip) return;
      bar.querySelectorAll("[data-filter]").forEach(function (c) {
        c.setAttribute("aria-pressed", "false");
      });
      chip.setAttribute("aria-pressed", "true");
      apply(chip.getAttribute("data-filter"));
    });
  });
})();
