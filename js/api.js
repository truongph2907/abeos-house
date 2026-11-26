/* Tải quán + thực đơn và gửi / tra cứu đơn qua API. */
(function () {
  var CACHE_KEY = "abeos-house:catalog";
  var FORCE_KEY = "abeos-house:catalog-force";
  var CACHE_MS = 10 * 60 * 1000;
  var CATALOG_TIMEOUT = 25000;
  var ORDER_TIMEOUT = 30000;
  var CATALOG_NETWORK = "Không tải được thực đơn. Máy chủ có thể đang khởi động. Đợi vài giây rồi thử lại.";
  var ORDER_NETWORK = "Không kết nối được quán. Máy chủ có thể đang khởi động. Giỏ vẫn còn. Đợi vài giây rồi bấm đặt món lần nữa.";
  var LOOKUP_NETWORK = "Không kết nối được quán. Máy chủ có thể đang khởi động. Đợi vài giây rồi thử lại.";

  function apiBase() {
    return String((window.App && App.API_BASE) || "").trim().replace(/\/+$/, "");
  }

  function apiUrl(path) {
    return apiBase() + path;
  }

  function fail(message, extra) {
    var error = new Error(message);
    if (extra) {
      error.status = extra.status;
      error.fields = extra.fields || null;
      error.network = !!extra.network;
    }
    return error;
  }

  function setStatus(text, warn, onRetry) {
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
    el.textContent = "";
    el.appendChild(document.createTextNode(text));
    if (onRetry) {
      el.appendChild(document.createTextNode(" "));
      var button = document.createElement("button");
      button.type = "button";
      button.className = "text-btn";
      button.textContent = "Thử lại";
      button.addEventListener("click", onRetry);
      el.appendChild(button);
    }
  }

  function retryCatalog() {
    try { sessionStorage.setItem(FORCE_KEY, "1"); } catch (error) { /* bộ nhớ riêng tư */ }
    location.reload();
  }

  function consumeForce() {
    try {
      var force = sessionStorage.getItem(FORCE_KEY) === "1";
      if (force) sessionStorage.removeItem(FORCE_KEY);
      return force;
    } catch (error) {
      return false;
    }
  }

  function readCache(base) {
    try {
      var parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || parsed.base !== base || !parsed.shop || !parsed.menu) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeCache(base, shop, menu) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ base: base, at: Date.now(), shop: shop, menu: menu }));
    } catch (error) {
      /* Bộ nhớ đầy thì bỏ qua cache. */
    }
  }

  var SAMPLE_SHOP = JSON.parse(JSON.stringify(App.SHOP));

  function applyCatalog(shop, menu) {
    if (shop) App.SHOP = App.mergeShop(SAMPLE_SHOP, shop);
    App.MENU = menu;
    if (App.ensureMenu) App.ensureMenu(menu);
    var seen = {};
    var categories = [];
    menu.forEach(function (item) {
      if (seen[item.category]) return;
      seen[item.category] = true;
      categories.push({ id: item.category, label: item.categoryLabel || item.category });
    });
    if (categories.length) App.CATEGORIES = categories;
  }

  function phoneTelFrom(phone) {
    var digits = String(phone || "").replace(/[^\d+]/g, "");
    if (/^0\d{9}$/.test(digits)) return "+84" + digits.slice(1);
    if (/^\+84\d{9}$/.test(digits)) return digits;
    return digits;
  }

  function shopFromApi(data) {
    var source = data || {};
    var phone = source.phone || "";
    var bank = source.bank || {};
    var account = String(bank.accountNumber || "");
    return {
      name: source.name || "",
      tagline: source.tagline || "",
      heroImage: App.driveImageUrl(source.heroImage || ""),
      heroCaption: source.heroCaption || "",
      logo: App.driveImageUrl(source.logo || ""),
      address: source.address || "",
      phone: phone,
      phoneTel: phoneTelFrom(phone),
      hours: source.hours || "",
      deliveryFee: Number(source.deliveryFee) || 0,
      bank: {
        bankName: bank.bankName || "",
        accountNumber: account,
        accountName: bank.accountName || "",
        branch: bank.branch || "",
        placeholder: account === "0000000000",
        note: bank.note || ""
      }
    };
  }

  function menuFromApi(list) {
    var items = [];
    (Array.isArray(list) ? list : []).forEach(function (raw) {
      if (!raw || !raw.name || raw.active === false) return;
      var code = String(raw.code || "").trim();
      items.push({
        id: code || raw.name,
        name: raw.name,
        blurb: raw.description || "",
        category: raw.category || "",
        categoryLabel: raw.categoryLabel || raw.category || "",
        image: App.driveImageUrl(raw.imageUrl || ""),
        price: Number(raw.price) || 0,
        options: App.parseOptions(raw.options || ""),
        popular: raw.featured === true,
        noteHint: raw.noteHint || "",
        sort: Number(raw.sortOrder) || 0
      });
    });
    return items;
  }

  function request(path, options) {
    var opts = options || {};
    var base = apiBase();
    if (!base) return Promise.reject(fail("Chưa cấu hình địa chỉ máy chủ."));
    var timeout = opts.timeout || CATALOG_TIMEOUT;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, timeout) : 0;
    var init = {
      method: opts.method || "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    };
    if (opts.body != null) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    if (controller) init.signal = controller.signal;
    return fetch(apiUrl(path), init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try { data = JSON.parse(text); } catch (error) { data = null; }
        }
        return { ok: res.ok, status: res.status, data: data };
      });
    }).catch(function () {
      throw fail(opts.networkMessage || LOOKUP_NETWORK, { network: true });
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  function problemMessage(data, status) {
    var fields = data && data.fields;
    var parts = [];
    if (fields && typeof fields === "object") {
      Object.keys(fields).forEach(function (key) {
        if (fields[key]) parts.push(String(fields[key]));
      });
    }
    if (parts.length) return parts.join(" ");
    if (data && data.detail) return String(data.detail);
    if (status === 429) return "Gửi đơn quá nhanh. Thử lại sau một phút.";
    if (status === 413) return "Nội dung đơn quá lớn.";
    if (status === 404) return "Không thấy đơn.";
    return "Không thực hiện được. Thử lại.";
  }

  function rejectProblem(res) {
    throw fail(problemMessage(res.data, res.status), {
      status: res.status,
      fields: res.data && res.data.fields
    });
  }

  function loadFromNetwork() {
    return Promise.all([
      request("/api/shop", { timeout: CATALOG_TIMEOUT, networkMessage: CATALOG_NETWORK }),
      request("/api/products", { timeout: CATALOG_TIMEOUT, networkMessage: CATALOG_NETWORK })
    ]).then(function (parts) {
      if (!parts[0].ok || !parts[1].ok) {
        var failed = !parts[0].ok ? parts[0] : parts[1];
        rejectProblem(failed);
      }
      var shop = shopFromApi(parts[0].data);
      var menu = menuFromApi(parts[1].data);
      if (!shop.name) throw fail("Máy chủ chưa có thông tin quán.");
      return { shop: shop, menu: menu };
    });
  }

  App.loadCatalog = function () {
    var base = apiBase();
    var force = consumeForce();
    if (!base) {
      App.MENU = [];
      setStatus("Chưa cấu hình địa chỉ máy chủ.", true);
      App.catalog = { source: "error", failed: true };
      return Promise.resolve(App.catalog);
    }
    var cached = readCache(base);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) {
      applyCatalog(cached.shop, cached.menu);
      setStatus("");
      App.catalog = { source: "cache" };
      return Promise.resolve(App.catalog);
    }
    setStatus("Đang tải thực đơn…", false);
    return loadFromNetwork().then(function (fresh) {
      applyCatalog(fresh.shop, fresh.menu);
      writeCache(base, fresh.shop, fresh.menu);
      if (!fresh.menu.length) setStatus("Thực đơn đang trống.", true, retryCatalog);
      else setStatus("");
      App.catalog = { source: "api", empty: !fresh.menu.length };
      return App.catalog;
    }).catch(function (error) {
      var message = (error && error.message) || CATALOG_NETWORK;
      if (cached && cached.menu && cached.menu.length) {
        applyCatalog(cached.shop, cached.menu);
        setStatus(message + " Đang hiện bản đã lưu trên máy.", true, retryCatalog);
        App.catalog = { source: "cache", stale: true };
        return App.catalog;
      }
      App.MENU = [];
      setStatus(message, true, retryCatalog);
      App.catalog = { source: "error", failed: true };
      return App.catalog;
    });
  };

  function deliveryType(value) {
    if (value === "DELIVERY" || value === "delivery") return "DELIVERY";
    if (value === "PICKUP" || value === "pickup") return "PICKUP";
    if (value === "DINE_IN" || value === "dinein" || value === "dine_in") return "DINE_IN";
    return "";
  }

  function paymentMethod(value) {
    if (value === "CASH" || value === "cash") return "CASH";
    if (value === "TRANSFER" || value === "transfer") return "TRANSFER";
    return "";
  }

  function fromDelivery(value) {
    if (value === "DELIVERY") return "delivery";
    if (value === "PICKUP") return "pickup";
    if (value === "DINE_IN") return "dinein";
    return value || "";
  }

  function fromPayment(value) {
    if (value === "CASH") return "cash";
    if (value === "TRANSFER") return "transfer";
    return value || "";
  }

  function splitToppings(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) { return String(item || "").trim(); }).filter(Boolean);
    }
    return String(value || "").split("|").map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function itemBody(line) {
    var toppings = line.toppingLabels || line.toppings || [];
    return {
      productCode: String(line.productCode || line.id || line.itemId || "").trim(),
      quantity: Math.round(Number(line.quantity != null ? line.quantity : line.qty)),
      size: String(line.sizeLabel || line.size || "").trim(),
      sugar: String(line.sugarLabel || line.sugar || "").trim(),
      ice: String(line.iceLabel || line.ice || "").trim(),
      toppings: splitToppings(toppings),
      note: String(line.note || "").slice(0, 140)
    };
  }

  function toRequest(payload) {
    var source = payload || {};
    var lines = source.items || source.lines || [];
    return {
      code: String(source.code || source.id || "").trim(),
      customerName: String(source.customerName || "").trim(),
      phone: String(source.phone || "").trim(),
      address: String(source.address || "").trim(),
      deliveryType: deliveryType(source.deliveryType || source.fulfillment),
      paymentMethod: paymentMethod(source.paymentMethod || source.payment),
      note: String(source.note || "").slice(0, 240),
      items: lines.map(itemBody)
    };
  }

  function linesFromResponse(items) {
    return (items || []).map(function (item) {
      var toppings = splitToppings(item.toppings);
      var size = item.size || "";
      var sugar = item.sugar || "";
      var ice = item.ice || "";
      return {
        itemId: item.productCode || "",
        name: item.productName || "",
        image: "",
        size: size,
        sizeLabel: size,
        sugar: sugar,
        sugarLabel: sugar,
        ice: ice,
        iceLabel: ice,
        toppingIds: toppings.slice(),
        toppingLabels: toppings,
        note: item.note || "",
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0
      };
    });
  }

  function normalizeOrder(body) {
    if (!body || !body.code) return null;
    var full = Array.isArray(body.items) || body.customerName != null || body.phone != null;
    if (!full) {
      return {
        summary: true,
        id: body.code,
        createdAt: body.createdAt || "",
        status: body.status || "",
        total: Number(body.total) || 0,
        itemCount: Number(body.itemCount) || 0
      };
    }
    return {
      id: body.code,
      sent: true,
      createdAt: body.createdAt || "",
      customer: {
        name: body.customerName || "",
        phone: body.phone || ""
      },
      address: body.address || "",
      fulfillment: fromDelivery(body.deliveryType),
      payment: fromPayment(body.paymentMethod),
      note: body.note || "",
      lines: linesFromResponse(body.items),
      subtotal: Number(body.subtotal) || 0,
      deliveryFee: Number(body.deliveryFee) || 0,
      total: Number(body.total) || 0,
      status: body.status || ""
    };
  }

  App.lookupOrder = function (code, phone) {
    var path = "/api/orders/" + encodeURIComponent(code);
    if (phone) path += "?phone=" + encodeURIComponent(phone);
    return request(path, { timeout: ORDER_TIMEOUT, networkMessage: LOOKUP_NETWORK }).then(function (res) {
      if (!res.ok) rejectProblem(res);
      var order = normalizeOrder(res.data);
      if (!order) throw fail("Không đọc được đơn.");
      return order;
    });
  };

  App.postOrder = function (payload) {
    var body = toRequest(payload);
    if (!body.code) return Promise.reject(fail("Thiếu mã đơn."));
    return request("/api/orders", {
      method: "POST",
      body: body,
      timeout: ORDER_TIMEOUT,
      networkMessage: ORDER_NETWORK
    }).then(function (res) {
      if (!res.ok) rejectProblem(res);
      var order = normalizeOrder(res.data);
      if (!order || order.summary) throw fail("Không đọc được đơn đã gửi.");
      return order;
    }).catch(function (error) {
      if (!error || !error.network) throw error;
      return App.lookupOrder(body.code, body.phone).then(function (order) {
        if (order && !order.summary && order.id) return order;
        throw error;
      }).catch(function (lookupError) {
        if (lookupError && (lookupError.network || lookupError.status === 404)) throw error;
        throw lookupError;
      });
    });
  };
})();
