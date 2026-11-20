/* Tải Shop + Products từ Google Sheet (ai có link cũng xem được) và gửi đơn tới Apps Script. */
(function () {
  var CACHE_KEY = "abeos-house:catalog";
  var CACHE_MS = 10 * 60 * 1000;

  function sheetsConfig() {
    var cfg = (window.App && App.SHEETS) || {};
    return {
      spreadsheetId: App.normalizeSpreadsheetId(cfg.spreadsheetId),
      scriptUrl: String(cfg.scriptUrl || "").trim()
    };
  }

  function setStatus(text, warn) {
    var el = document.getElementById("catalog-status");
    if (!text) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "catalog-status";
      el.className = "catalog-status";
      el.setAttribute("role", "status");
      var header = document.querySelector(".site-header");
      if (header && header.parentNode) header.parentNode.insertBefore(el, header.nextSibling);
      else document.body.insertBefore(el, document.body.firstChild);
    }
    el.hidden = false;
    el.classList.toggle("is-warn", !!warn);
    el.textContent = text;
  }

  function readCache(id) {
    try {
      var parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || parsed.id !== id || !parsed.shop || !parsed.menu) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeCache(id, shop, menu) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ id: id, at: Date.now(), shop: shop, menu: menu }));
    } catch (error) {
      /* Bộ nhớ đầy thì bỏ qua cache. */
    }
  }

  var SAMPLE_SHOP = JSON.parse(JSON.stringify(App.SHOP));

  function applyCatalog(shop, menu) {
    if (shop) App.SHOP = App.mergeShop(SAMPLE_SHOP, shop);
    App.MENU = menu;
    var seen = {};
    var categories = [];
    menu.forEach(function (item) {
      if (seen[item.category]) return;
      seen[item.category] = true;
      categories.push({ id: item.category, label: item.categoryLabel || item.category });
    });
    if (categories.length) App.CATEGORIES = categories;
  }

  function useSample() {
    App.ensureMenu(App.MENU);
  }

  function csvUrl(id, sheetName) {
    return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(id) +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(sheetName);
  }

  function fetchText(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : 0;
    var opts = { cache: "no-store" };
    if (controller) opts.signal = controller.signal;
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    }).then(function (text) {
      if (/^\s*</.test(text)) throw new Error("Không phải CSV");
      return text;
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  function loadFromNetwork(id) {
    return Promise.all([
      fetchText(csvUrl(id, "Shop")),
      fetchText(csvUrl(id, "Products"))
    ]).then(function (parts) {
      var shop = App.shopFromCsv(parts[0]);
      var menu = App.productsFromCsv(parts[1]);
      if (!shop.name || !menu.length) throw new Error("Sheet thiếu dữ liệu");
      return { shop: shop, menu: menu };
    });
  }

  App.loadCatalog = function () {
    var id = sheetsConfig().spreadsheetId;
    if (!id) {
      useSample();
      setStatus("");
      App.catalog = { source: "sample" };
      return Promise.resolve(App.catalog);
    }
    var cached = readCache(id);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      applyCatalog(cached.shop, cached.menu);
      setStatus("");
      App.catalog = { source: "cache" };
      return Promise.resolve(App.catalog);
    }
    setStatus("Đang tải thực đơn…", false);
    return loadFromNetwork(id).then(function (fresh) {
      applyCatalog(fresh.shop, fresh.menu);
      writeCache(id, fresh.shop, fresh.menu);
      setStatus("");
      App.catalog = { source: "sheet" };
      return App.catalog;
    }).catch(function () {
      if (cached) {
        applyCatalog(cached.shop, cached.menu);
        setStatus("Không tải được Google Sheet. Đang hiện bản đã lưu trên máy.", true);
        App.catalog = { source: "cache", stale: true };
        return App.catalog;
      }
      useSample();
      setStatus("Không tải được Google Sheet. Đang hiện thực đơn mẫu.", true);
      App.catalog = { source: "sample", failed: true };
      return App.catalog;
    });
  };

  App.postOrder = function (payload) {
    var url = sheetsConfig().scriptUrl;
    if (!url) {
      return Promise.reject(new Error("Chưa nối đơn tới Google Sheet. Chủ quán cần dán link Apps Script trong js/config.js."));
    }
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    }).then(function (res) {
      return res.text();
    }).then(function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error("Quán không phản hồi. Đơn chưa được gửi, giỏ vẫn còn.");
      }
      if (!data || data.ok !== true || !data.order || !data.order.id) {
        throw new Error((data && data.error) || "Không gửi được đơn. Giỏ vẫn còn.");
      }
      data.order.sent = true;
      return data.order;
    }).catch(function (error) {
      if (error && error.message && !/Failed to fetch|NetworkError|Load failed|abort/i.test(error.message)) throw error;
      throw new Error("Không gửi được đơn. Kiểm tra mạng rồi thử lại. Giỏ vẫn còn.");
    });
  };
})();
