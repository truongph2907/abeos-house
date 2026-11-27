/* Trang chủ quán. Không gắn vào menu công khai. */
(function () {
  "use strict";

  var TOKEN_KEY = "abeos-house:admin-token";
  var EXP_KEY = "abeos-house:admin-expires";
  var REQUEST_MS = 30000;
  var REQUEST_RETRY_MS = 60000;
  var REQUEST_RETRIES = 2;
  var ORDER_REFRESH_MS = 60000;
  var NETWORK = "Không kết nối được, anh/chị thử lại nhé.";
  var SLOW = "Chưa vào được, anh/chị thử lại nhé.";
  var SESSION_EXPIRED = "Hết giờ đăng nhập. Nhập mật khẩu lại.";
  var LOGIN_FAILED = "Không đăng nhập được, anh/chị thử lại nhé.";

  var ORDER_STATUS = [
    { id: "NEW", label: "Mới" },
    { id: "ACCEPTED", label: "Đã nhận" },
    { id: "DONE", label: "Hoàn tất" },
    { id: "CANCELLED", label: "Đã hủy" }
  ];

  var DELIVERY = {
    DELIVERY: "Giao hàng",
    PICKUP: "Mang về",
    DINE_IN: "Dùng tại quán",
    delivery: "Giao hàng",
    pickup: "Mang về",
    dinein: "Dùng tại quán"
  };

  var PAYMENT = {
    CASH: "Tiền mặt khi nhận",
    TRANSFER: "Chuyển khoản",
    cash: "Tiền mặt khi nhận",
    transfer: "Chuyển khoản"
  };

  var state = {
    view: "login",
    tab: "shop",
    sawSession: false,
    shop: null,
    shopLoading: false,
    shopLoaded: false,
    products: [],
    productsLoading: false,
    productsLoaded: false,
    productQuery: "",
    editingCode: "",
    orders: [],
    orderFilter: "",
    ordersLoading: false,
    ordersStale: false,
    expandedOrder: ""
  };

  var orderTimer = 0;
  var orderSeq = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function h(tag, props) {
    var node = document.createElement(tag);
    var children = [];
    props = props || {};
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (key === "class") node.className = value == null ? "" : String(value);
      else if (key === "text") node.textContent = value == null ? "" : String(value);
      else if (key === "children") children = value || [];
      else if (key === "on") {
        Object.keys(value || {}).forEach(function (type) {
          node.addEventListener(type, value[type]);
        });
      } else if (key === "value") node.value = value == null ? "" : String(value);
      else if (key === "checked" || key === "selected" || key === "disabled" || key === "hidden" || key === "required" || key === "readOnly") {
        node[key] = !!value;
        if (value) node.setAttribute(key === "readOnly" ? "readonly" : key, "");
        else node.removeAttribute(key === "readOnly" ? "readonly" : key);
      } else if (value === false || value == null) return;
      else node.setAttribute(key, String(value));
    });
    children.forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    if (node) node.textContent = "";
  }

  function fold(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatVnd(amount) {
    var rounded = Math.round(Number(amount) || 0);
    var sign = rounded < 0 ? "−" : "";
    var digits = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + digits + "đ";
  }

  function formatWhen(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    try {
      return new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(date);
    } catch (error) {
      return date.toLocaleString("vi-VN");
    }
  }

  function slug(value) {
    return fold(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  }

  function statusLabel(code) {
    var found = ORDER_STATUS.filter(function (item) { return item.id === code; })[0];
    return found ? found.label : (code || "Chưa rõ");
  }

  function splitList(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) { return String(item || "").trim(); }).filter(Boolean);
    }
    return String(value || "").split("|").map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function displayImageUrl(value) {
    var url = String(value || "").trim();
    if (!url || /^(javascript|data):/i.test(url)) return "";
    if (window.App && typeof App.driveImageUrl === "function") {
      url = App.driveImageUrl(url) || url;
    }
    return url;
  }

  function safeImage(value) {
    var url = String(value || "").trim();
    if (!url) return "";
    if (/^(javascript|data):/i.test(url)) return null;
    return url;
  }

  function showStatus(el, text, kind, onRetry) {
    if (!el) return;
    el.hidden = !text && !onRetry;
    el.className = kind === "ok" ? "admin-ok" : kind === "error" ? "notice" : kind === "muted" ? "admin-muted" : "admin-busy";
    el.setAttribute("role", kind === "error" ? "alert" : "status");
    clear(el);
    if (text) el.appendChild(document.createTextNode(text));
    if (onRetry) {
      if (text) el.appendChild(document.createTextNode(" "));
      el.appendChild(h("button", { type: "button", class: "text-btn", text: "Thử lại", on: { click: onRetry } }));
    }
  }

  function field(label, control, errorName) {
    return h("div", { children: [
      h("label", { class: "field", children: [h("span", { text: label }), control] }),
      h("p", { class: "field-error", "data-error": errorName })
    ]});
  }

  function applyFieldErrors(form, fields) {
    if (!form) return;
    form.querySelectorAll("[data-error]").forEach(function (el) { el.textContent = ""; });
    if (!fields || typeof fields !== "object") return;
    Object.keys(fields).forEach(function (key) {
      var local = key.indexOf(".") >= 0 ? key.slice(key.lastIndexOf(".") + 1) : key;
      if (local === "note") local = "bankNote";
      form.querySelectorAll("[data-error]").forEach(function (el) {
        var name = el.getAttribute("data-error");
        if ((name === key || name === local) && fields[key]) el.textContent = String(fields[key]);
      });
    });
  }

  function expiryMs(value) {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
    var text = String(value).trim();
    if (/^\d+$/.test(text)) {
      var numeric = Number(text);
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    var parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function readRawSession() {
    try {
      return {
        token: sessionStorage.getItem(TOKEN_KEY) || "",
        exp: sessionStorage.getItem(EXP_KEY) || ""
      };
    } catch (error) {
      return { token: "", exp: "", blocked: true };
    }
  }

  function sessionValid() {
    var raw = readRawSession();
    if (!raw.token) return false;
    var ms = expiryMs(raw.exp);
    if (ms && Date.now() >= ms) return false;
    return true;
  }

  function saveSession(token, expiresAt) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXP_KEY, expiresAt == null ? "" : String(expiresAt));
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EXP_KEY);
    } catch (error) { /* bộ nhớ riêng tư */ }
  }

  function fail(message, extra) {
    var error = new Error(message);
    error.app = true;
    if (extra) Object.keys(extra).forEach(function (key) { error[key] = extra[key]; });
    return error;
  }

  function problemMessage(data, status) {
    var fields = data && data.fields;
    if (fields && typeof fields === "object") {
      var parts = Object.keys(fields).map(function (key) { return fields[key]; }).filter(Boolean).map(String);
      if (parts.length) return parts.join(" ");
    }
    if (data && data.detail) return String(data.detail);
    if (data && typeof data.error === "string") return data.error;
    if (data && typeof data.message === "string") return data.message;
    if (status === 401) return SESSION_EXPIRED;
    if (status === 403) return "Không có quyền thực hiện.";
    if (status === 404) return "Không tìm thấy.";
    if (status === 409) return "Mục này đã có.";
    if (status === 413) return "Nội dung quá lớn.";
    if (status === 429) return "Thao tác quá nhanh. Đợi một lát rồi thử lại.";
    if (status >= 500) return "Không thực hiện được, anh/chị thử lại nhé.";
    return "Không thực hiện được. Thử lại.";
  }

  function apiBase() {
    return String((window.App && App.API_BASE) || "").trim().replace(/\/+$/, "");
  }

  function endSession(message) {
    clearSession();
    stopOrderRefresh();
    showLogin(message || SESSION_EXPIRED);
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function shouldRetry(error, tryIndex) {
    if (tryIndex >= REQUEST_RETRIES) return false;
    if (!error) return false;
    if (error.network) return true;
    if (error.status >= 500) return true;
    return false;
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    var base = apiBase();
    if (!base) return Promise.reject(fail("Chưa kết nối được quán."));
    if (!opts.anonymous && !sessionValid()) {
      endSession(SESSION_EXPIRED);
      return Promise.reject(fail(SESSION_EXPIRED, { auth: true, status: 401 }));
    }

    function once(timeout) {
      var headers = { Accept: "application/json" };
      if (!opts.anonymous) headers.Authorization = "Bearer " + readRawSession().token;
      var init = { method: method, headers: headers, cache: "no-store" };
      if (body != null) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, timeout) : 0;
      if (controller) init.signal = controller.signal;
      return fetch(base + path, init).then(function (res) {
        return res.text().then(function (text) { return { res: res, text: text }; });
      }).then(function (packet) {
        var data = null;
        if (packet.text) {
          try { data = JSON.parse(packet.text); }
          catch (parseError) {
            throw fail(packet.res.ok ? "Không đọc được dữ liệu." : problemMessage(null, packet.res.status), { status: packet.res.status });
          }
        }
        if (packet.res.status === 401 && !opts.anonymous) {
          endSession(SESSION_EXPIRED);
          throw fail(SESSION_EXPIRED, { auth: true, status: 401 });
        }
        if (!packet.res.ok) {
          throw fail(opts.anonymous && packet.res.status === 401 ? "Sai mật khẩu." : problemMessage(data, packet.res.status), {
            status: packet.res.status,
            fields: data && data.fields
          });
        }
        return data;
      }).catch(function (error) {
        if (error && error.app) throw error;
        var aborted = error && error.name === "AbortError";
        throw fail(aborted ? SLOW : NETWORK, { network: true });
      }).finally(function () {
        if (timer) clearTimeout(timer);
      });
    }

    function attempt(tryIndex) {
      var timeout = tryIndex === 0 ? (opts.timeout || REQUEST_MS) : (opts.retryTimeout || REQUEST_RETRY_MS);
      return once(timeout).catch(function (error) {
        if (!shouldRetry(error, tryIndex)) throw error;
        return wait(800 * (tryIndex + 1)).then(function () { return attempt(tryIndex + 1); });
      });
    }

    return attempt(0);
  }

  function showLogin(message) {
    state.view = "login";
    state.shopLoaded = false;
    state.shopLoading = false;
    state.productsLoaded = false;
    state.productsLoading = false;
    state.orders = [];
    var logout = $("admin-logout");
    if (logout) logout.hidden = true;
    var root = $("admin-app");
    clear(root);
    var banner = h("p", { class: "notice", role: "alert", hidden: !message, text: message || "" });
    var password = h("input", { name: "password", type: "password", autocomplete: "current-password", required: true });
    var button = h("button", { class: "btn btn-primary btn-block", type: "submit", text: "Đăng nhập" });
    var form = h("form", { id: "login-form", class: "card admin-login", novalidate: true, children: [
      h("h2", { text: "Đăng nhập" }),
      h("p", { class: "muted", text: "Trang của chủ quán. Nhập mật khẩu để sửa quán, món và đơn." }),
      field("Mật khẩu", password, "password"),
      banner,
      button
    ]});
    root.appendChild(h("header", { class: "page-intro", children: [
      h("h1", { text: "Quản trị" }),
      h("p", { text: "A Béo's House" })
    ]}));
    root.appendChild(form);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      applyFieldErrors(form, {});
      banner.hidden = true;
      var value = password.value;
      if (!value) {
        applyFieldErrors(form, { password: "Nhập mật khẩu." });
        password.focus();
        return;
      }
      button.disabled = true;
      button.textContent = "Đang đăng nhập…";
      request("POST", "/api/admin/login", { password: value }, { anonymous: true }).then(function (data) {
        var token = data && data.token ? String(data.token) : "";
        if (!token) throw fail(LOGIN_FAILED);
        var expiresAt = data.expiresAt == null ? "" : data.expiresAt;
        var ms = expiryMs(expiresAt);
        if (ms && Date.now() >= ms) throw fail(LOGIN_FAILED);
        try { saveSession(token, expiresAt); }
        catch (storageError) { throw fail(LOGIN_FAILED); }
        state.sawSession = true;
        password.value = "";
        showApp();
      }).catch(function (failure) {
        button.disabled = false;
        button.textContent = "Đăng nhập";
        if (failure && failure.fields) applyFieldErrors(form, failure.fields);
        banner.hidden = false;
        banner.textContent = (failure && failure.status === 401) ? "Sai mật khẩu." : LOGIN_FAILED;
      });
    });
    password.focus();
  }

  function showApp() {
    state.view = "app";
    var logout = $("admin-logout");
    if (logout) logout.hidden = false;
    if (!$("panel-shop")) {
      state.tab = "shop";
      renderShell();
    }
    selectTab(state.tab || "shop");
  }

  function renderShell() {
    var root = $("admin-app");
    clear(root);
    root.appendChild(h("header", { class: "page-intro", children: [
      h("h1", { text: "Quản trị" }),
      h("p", { text: "Sửa thông tin quán, món và đơn hàng." })
    ]}));
    root.appendChild(h("nav", { class: "admin-tabs", role: "tablist", "aria-label": "Mục quản trị", children: [
      tabButton("shop", "Thông tin quán", "Quán", tabIconStore()),
      tabButton("products", "Món", "Món", tabIconCup()),
      tabButton("orders", "Đơn hàng", "Đơn hàng", tabIconReceipt())
    ]}));
    root.appendChild(shopPanel());
    root.appendChild(productsPanel());
    root.appendChild(ordersPanel());
    var search = $("product-search");
    search.addEventListener("input", function () {
      state.productQuery = search.value;
      renderProductList();
    });
    bindPreview($("shop-hero"), $("shop-hero-preview"));
    bindPreview($("shop-logo"), $("shop-logo-preview"));
  }

  function tabIcon(pathD) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "admin-tab-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }

  function tabIconStore() {
    return tabIcon("M4 10h16v9H4zm0 0l2-5h12l2 5M3 10h18M9 19v-5h6v5");
  }

  function tabIconCup() {
    return tabIcon("M5 3h11v8.5A4.5 4.5 0 0 1 11.5 16H9.5A4.5 4.5 0 0 1 5 11.5V3zm11 3h2.25A2.75 2.75 0 0 1 21 8.75 2.75 2.75 0 0 1 18.25 11.5H16M8 18h8v2H8z");
  }

  function tabIconReceipt() {
    return tabIcon("M6 2h12v20l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2V2zm3.5 5h5v1.6h-5V7zm0 3.5h5V12h-5v-1.5zm0 3.5h3.5V14H9.5V13.5z");
  }

  function tabButton(id, fullLabel, shortLabel, icon) {
    return h("button", {
      type: "button",
      role: "tab",
      id: "tab-" + id,
      "data-tab": id,
      "aria-controls": "panel-" + id,
      "aria-selected": "false",
      "aria-label": fullLabel,
      children: [icon, h("span", { class: "admin-tab-label", text: shortLabel })]
    });
  }

  function selectTab(name) {
    state.tab = name;
    ["shop", "products", "orders"].forEach(function (tab) {
      var panel = $("panel-" + tab);
      var button = $("tab-" + tab);
      var on = tab === name;
      if (panel) {
        panel.hidden = !on;
        panel.setAttribute("aria-hidden", on ? "false" : "true");
      }
      if (button) {
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-selected", on ? "true" : "false");
        if (on) button.setAttribute("tabindex", "0");
        else button.setAttribute("tabindex", "-1");
      }
    });
    if (name === "shop") ensureShop();
    if (name === "products") ensureProducts();
    if (name === "orders") {
      ensureOrders();
      startOrderRefresh();
    } else stopOrderRefresh();
  }

  function shopPanel() {
    var inputs = {
      name: h("input", { name: "name", autocomplete: "organization", required: true }),
      tagline: h("input", { name: "tagline" }),
      heroImage: h("input", { id: "shop-hero", name: "heroImage", inputmode: "url", placeholder: "https://… hoặc img/…" }),
      heroCaption: h("input", { name: "heroCaption" }),
      logo: h("input", { id: "shop-logo", name: "logo", inputmode: "url", placeholder: "https://…" }),
      address: h("textarea", { name: "address", rows: "2" }),
      phone: h("input", { name: "phone", inputmode: "tel", autocomplete: "tel" }),
      hours: h("input", { name: "hours" }),
      deliveryFee: h("input", { name: "deliveryFee", inputmode: "numeric", type: "number", min: "0", step: "1000" }),
      bankName: h("input", { name: "bankName" }),
      accountNumber: h("input", { name: "accountNumber", inputmode: "numeric" }),
      accountName: h("input", { name: "accountName" }),
      branch: h("input", { name: "branch" }),
      bankNote: h("textarea", { name: "bankNote", rows: "3" })
    };
    return h("section", { id: "panel-shop", role: "tabpanel", "aria-labelledby": "tab-shop", children: [
      h("p", { id: "shop-status", class: "admin-busy", hidden: true }),
      h("form", { id: "shop-form", novalidate: true, hidden: true, children: [
        field("Tên quán", inputs.name, "name"),
        field("Khẩu hiệu", inputs.tagline, "tagline"),
        field("Ảnh bìa (URL)", inputs.heroImage, "heroImage"),
        h("img", { id: "shop-hero-preview", class: "admin-preview", alt: "Xem trước ảnh bìa", hidden: true }),
        field("Chú thích ảnh bìa", inputs.heroCaption, "heroCaption"),
        field("Logo (URL)", inputs.logo, "logo"),
        h("img", { id: "shop-logo-preview", class: "admin-preview", alt: "Xem trước logo", hidden: true }),
        field("Địa chỉ", inputs.address, "address"),
        field("Điện thoại", inputs.phone, "phone"),
        field("Giờ mở cửa", inputs.hours, "hours"),
        field("Phí giao hàng (đồng)", inputs.deliveryFee, "deliveryFee"),
        h("p", { class: "muted admin-help", text: "Nhập 15000 nếu phí là 15.000đ. Nhập 0 nếu miễn phí." }),
        h("h2", { text: "Tài khoản nhận chuyển khoản" }),
        field("Ngân hàng", inputs.bankName, "bankName"),
        field("Số tài khoản", inputs.accountNumber, "accountNumber"),
        field("Chủ tài khoản", inputs.accountName, "accountName"),
        field("Chi nhánh", inputs.branch, "branch"),
        field("Ghi chú chuyển khoản", inputs.bankNote, "bankNote"),
        h("button", { class: "btn btn-primary btn-block", type: "submit", text: "Lưu thông tin quán" })
      ]})
    ]});
  }

  function bindPreview(input, img) {
    if (!input || !img) return;
    var placeholder = img.nextElementSibling;
    if (!placeholder || !placeholder.classList.contains("admin-preview-empty")) {
      placeholder = h("div", { class: "admin-preview admin-preview-empty", hidden: true, text: "Không xem trước được ảnh" });
      if (img.parentNode) img.parentNode.insertBefore(placeholder, img.nextSibling);
    }
    function update() {
      var url = displayImageUrl(input.value);
      if (!url) {
        img.hidden = true;
        img.removeAttribute("src");
        placeholder.hidden = true;
        return;
      }
      placeholder.hidden = true;
      img.hidden = false;
      img.src = url;
    }
    input.addEventListener("input", update);
    img.addEventListener("error", function () {
      if (!img.getAttribute("src")) return;
      img.hidden = true;
      placeholder.hidden = false;
    });
    input._preview = update;
  }

  function ensureShop() {
    if (state.shopLoaded || state.shopLoading) return;
    state.shopLoading = true;
    var form = $("shop-form");
    if (form) form.hidden = true;
    showStatus($("shop-status"), "Đang tải thông tin quán…", "busy");
    request("GET", "/api/admin/shop").then(function (data) {
      if (state.view !== "app") return;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw fail("Không đọc được thông tin quán.");
      state.shop = data;
      state.shopLoaded = true;
      fillShop(data);
      showStatus($("shop-status"), "", "busy");
      if (form) form.hidden = false;
    }).catch(function (error) {
      if (error && error.auth) return;
      showStatus($("shop-status"), (error && error.message) || NETWORK, "error", function () {
        state.shopLoading = false;
        state.shopLoaded = false;
        ensureShop();
      });
    }).finally(function () { state.shopLoading = false; });
  }

  function setValue(form, name, value) {
    if (form.elements[name]) form.elements[name].value = value == null ? "" : String(value);
  }

  function fillShop(shop) {
    var form = $("shop-form");
    if (!form) return;
    var bank = shop.bank || {};
    setValue(form, "name", shop.name);
    setValue(form, "tagline", shop.tagline);
    setValue(form, "heroImage", shop.heroImage);
    setValue(form, "heroCaption", shop.heroCaption);
    setValue(form, "logo", shop.logo);
    setValue(form, "address", shop.address);
    setValue(form, "phone", shop.phone);
    setValue(form, "hours", shop.hours);
    setValue(form, "deliveryFee", shop.deliveryFee == null ? "" : shop.deliveryFee);
    setValue(form, "bankName", bank.bankName);
    setValue(form, "accountNumber", bank.accountNumber);
    setValue(form, "accountName", bank.accountName);
    setValue(form, "branch", bank.branch);
    setValue(form, "bankNote", bank.note);
    if (form.elements.heroImage && form.elements.heroImage._preview) form.elements.heroImage._preview();
    if (form.elements.logo && form.elements.logo._preview) form.elements.logo._preview();
  }

  function readShop(form) {
    function val(name) { return String(form.elements[name].value || "").trim(); }
    var feeRaw = String(form.elements.deliveryFee.value || "").trim();
    var fee = feeRaw === "" ? NaN : Number(feeRaw);
    return {
      name: val("name"),
      tagline: val("tagline"),
      heroImage: val("heroImage"),
      heroCaption: val("heroCaption"),
      logo: val("logo"),
      address: val("address"),
      phone: val("phone"),
      hours: val("hours"),
      deliveryFee: fee,
      bankName: val("bankName"),
      accountNumber: val("accountNumber"),
      accountName: val("accountName"),
      branch: val("branch"),
      bankNote: val("bankNote")
    };
  }

  function validateShop(edit) {
    var fields = {};
    if (!edit.name) fields.name = "Nhập tên quán.";
    if (!Number.isFinite(edit.deliveryFee) || edit.deliveryFee < 0) fields.deliveryFee = "Phí giao hàng phải là số từ 0 trở lên.";
    if (edit.phone && !/\d/.test(edit.phone)) fields.phone = "Số điện thoại chưa đúng.";
    if (safeImage(edit.heroImage) == null) fields.heroImage = "Đường dẫn ảnh không hợp lệ.";
    if (safeImage(edit.logo) == null) fields.logo = "Đường dẫn ảnh không hợp lệ.";
    return fields;
  }

  function shopPayload(edit) {
    var next = state.shop ? JSON.parse(JSON.stringify(state.shop)) : {};
    next.name = edit.name;
    next.tagline = edit.tagline;
    next.heroImage = safeImage(edit.heroImage) || "";
    next.heroCaption = edit.heroCaption;
    next.logo = safeImage(edit.logo) || "";
    next.address = edit.address;
    next.phone = edit.phone;
    next.hours = edit.hours;
    next.deliveryFee = Math.round(edit.deliveryFee);
    var bank = next.bank && typeof next.bank === "object" ? next.bank : {};
    bank.bankName = edit.bankName;
    bank.accountNumber = edit.accountNumber;
    bank.accountName = edit.accountName;
    bank.branch = edit.branch;
    bank.note = edit.bankNote;
    next.bank = bank;
    return next;
  }

  function saveShop(form) {
    var button = form.querySelector("[type=submit]");
    var edit = readShop(form);
    var fields = validateShop(edit);
    applyFieldErrors(form, fields);
    if (Object.keys(fields).length) {
      showStatus($("shop-status"), "Kiểm tra lại các ô được đánh dấu.", "error");
      return;
    }
    if (!state.shop) {
      showStatus($("shop-status"), "Chưa tải được thông tin quán.", "error");
      return;
    }
    button.disabled = true;
    var previous = button.textContent;
    button.textContent = "Đang lưu…";
    showStatus($("shop-status"), "Đang lưu thông tin quán…", "busy");
    var payload = shopPayload(edit);
    request("PUT", "/api/admin/shop", payload).then(function (data) {
      state.shop = data && typeof data === "object" && !Array.isArray(data) && (data.name != null || data.bank) ? data : payload;
      fillShop(state.shop);
      showStatus($("shop-status"), "Đã lưu thông tin quán.", "ok");
    }).catch(function (error) {
      if (error && error.auth) return;
      if (error && error.fields) applyFieldErrors(form, error.fields);
      showStatus($("shop-status"), (error && error.message) || "Không lưu được.", "error");
    }).finally(function () {
      button.disabled = false;
      button.textContent = previous;
    });
  }

  function productsPanel() {
    return h("section", { id: "panel-products", role: "tabpanel", "aria-labelledby": "tab-products", hidden: true, children: [
      h("p", { id: "product-status", class: "admin-busy", hidden: true }),
      h("div", { class: "menu-toolbar", children: [
        h("input", { id: "product-search", class: "search", type: "search", placeholder: "Tìm món, không cần dấu", "aria-label": "Tìm món" }),
        h("div", { class: "admin-actions", children: [
          h("button", { type: "button", class: "btn btn-primary", "data-action": "add-product", text: "Thêm món" })
        ]})
      ]}),
      h("div", { id: "product-form-slot" }),
      h("p", { id: "product-count", class: "count-line", hidden: true }),
      h("div", { id: "product-list" })
    ]});
  }

  function ensureProducts() {
    if (state.productsLoaded || state.productsLoading) return;
    state.productsLoading = true;
    var first = !state.products.length;
    if (first) showStatus($("product-status"), "Đang tải món…", "busy");
    request("GET", "/api/admin/products").then(function (data) {
      if (state.view !== "app") return;
      if (!Array.isArray(data)) throw fail("Không đọc được danh sách món.");
      state.products = data;
      state.productsLoaded = true;
      showStatus($("product-status"), "", "busy");
      renderProductList();
    }).catch(function (error) {
      if (error && error.auth) return;
      showStatus($("product-status"), (error && error.message) || NETWORK, "error", function () {
        state.productsLoading = false;
        state.productsLoaded = false;
        ensureProducts();
      });
    }).finally(function () { state.productsLoading = false; });
  }

  function sortedProducts() {
    return state.products.slice().sort(function (a, b) {
      var as = Number(a && a.sortOrder) || 0;
      var bs = Number(b && b.sortOrder) || 0;
      if (as !== bs) return as - bs;
      return String((a && a.name) || "").localeCompare(String((b && b.name) || ""), "vi");
    });
  }

  function renderProductList() {
    var host = $("product-list");
    var count = $("product-count");
    if (!host) return;
    clear(host);
    var query = fold(state.productQuery);
    var items = sortedProducts().filter(function (product) {
      if (!query) return true;
      return fold([product.name, product.code, product.description, product.categoryLabel, product.category].join(" ")).indexOf(query) !== -1;
    });
    if (count) {
      count.hidden = !state.productsLoaded;
      count.textContent = items.length + " món";
    }
    if (!items.length) {
      host.appendChild(h("div", { class: "empty", children: [
        h("h2", { text: state.products.length ? "Không thấy món" : "Chưa có món" }),
        h("p", { text: state.products.length ? "Thử từ khác. Không cần gõ dấu." : "Bấm Thêm món để tạo món đầu tiên." })
      ]}));
      return;
    }
    items.forEach(function (product) { host.appendChild(productCard(product)); });
  }

  function productCard(product) {
    var active = product.active !== false;
    var imageSrc = displayImageUrl(product.imageUrl);
    var placeholder = h("span", { class: "admin-thumb admin-thumb-empty", text: "Món" });
    var thumbChildren = [placeholder];
    if (imageSrc) {
      var img = h("img", { class: "admin-thumb", alt: product.name || "Món", src: imageSrc });
      placeholder.hidden = true;
      img.addEventListener("error", function () {
        img.hidden = true;
        placeholder.hidden = false;
      });
      thumbChildren = [placeholder, img];
    }
    var thumb = h("div", { class: "admin-thumb-frame", children: thumbChildren });
    return h("article", { class: "card admin-product" + (active ? "" : " is-off"), children: [
      h("div", { class: "admin-product-row", children: [
        thumb,
        h("div", { class: "admin-product-copy", children: [
          h("p", { class: "item-kicker", text: (product.categoryLabel || (product.category === "food" ? "Đồ ăn" : "Đồ uống")) + (product.featured ? " · Nổi bật" : "") }),
          h("h3", { text: product.name || product.code || "Món" }),
          h("p", { class: "muted admin-product-code", text: product.code || "" }),
          h("p", { class: "price", text: formatVnd(product.price) }),
          h("span", { class: "admin-status-pill" + (active ? " is-on" : " is-off"), text: active ? "Đang bán" : "Ngừng bán" })
        ]})
      ]}),
      h("div", { class: "admin-actions", children: [
        h("button", { type: "button", class: "text-btn", "data-edit": product.code || "", text: "Sửa" }),
        active
          ? h("button", { type: "button", class: "text-btn", "data-delete": product.code || "", text: "Ngừng bán" })
          : h("button", { type: "button", class: "text-btn", "data-toggle": product.code || "", "aria-pressed": "false", text: "Mở bán lại" })
      ]})
    ]});
  }


  var OPTION_GROUPS = [
    { key: "size", label: "Size", list: "sizes", writeZero: true },
    { key: "sugar", label: "Đường", list: "sugar", writeZero: false },
    { key: "ice", label: "Đá", list: "ice", writeZero: false },
    { key: "topping", label: "Topping", list: "toppings", writeZero: false }
  ];

  function choiceToOptionItem(choice) {
    return {
      name: String((choice && (choice.label || choice.id)) || "").trim(),
      extra: Number(choice && (choice.extra != null ? choice.extra : choice.price)) || 0
    };
  }

  function parseOptionText(text) {
    var empty = { size: [], sugar: [], ice: [], topping: [] };
    var parsed;
    if (window.App && typeof App.parseOptions === "function") {
      parsed = App.parseOptions(text);
    } else {
      return empty;
    }
    return {
      size: (parsed.sizes || []).map(choiceToOptionItem),
      sugar: (parsed.sugar || []).map(choiceToOptionItem),
      ice: (parsed.ice || []).map(choiceToOptionItem),
      topping: (parsed.toppings || []).map(choiceToOptionItem)
    };
  }

  function formatOptionChoice(name, extra, writeZero) {
    var label = String(name || "").trim();
    if (!label) return "";
    var amount = Number(extra);
    if (!Number.isFinite(amount)) amount = 0;
    amount = Math.round(amount);
    if (amount > 0) return label + " +" + amount;
    if (amount < 0) return label + " " + amount;
    return writeZero ? label + " 0" : label;
  }

  function serializeOptionsEditor(root) {
    if (!root) return "";
    var lines = [];
    OPTION_GROUPS.forEach(function (group) {
      var section = root.querySelector('[data-group="' + group.key + '"]');
      if (!section || section.getAttribute("data-enabled") !== "true") return;
      var parts = [];
      Array.prototype.forEach.call(section.querySelectorAll("[data-option-row]"), function (row) {
        var nameEl = row.querySelector("[data-opt-name]");
        var extraEl = row.querySelector("[data-opt-extra]");
        var part = formatOptionChoice(nameEl ? nameEl.value : "", extraEl ? extraEl.value : 0, group.writeZero);
        if (part) parts.push(part);
      });
      if (parts.length) lines.push(group.key + ": " + parts.join(" | "));
    });
    return lines.join("\n");
  }

  function optionRow(item) {
    item = item || { name: "", extra: 0 };
    var extraValue = item.extra == null || item.extra === "" ? "" : String(item.extra);
    return h("div", { class: "admin-option-row", "data-option-row": "true", children: [
      h("input", { class: "admin-option-name", "data-opt-name": "true", type: "text", value: item.name || "", placeholder: "Tên lựa chọn", "aria-label": "Tên lựa chọn" }),
      h("label", { class: "admin-option-price", children: [
        h("input", { "data-opt-extra": "true", type: "number", step: "1000", inputmode: "numeric", value: extraValue, placeholder: "0", "aria-label": "Giá thêm (đồng)" }),
        h("span", { text: "đ" })
      ]}),
      h("button", { type: "button", class: "admin-option-icon", "data-opt-up": "true", "aria-label": "Đưa lên", text: "↑" }),
      h("button", { type: "button", class: "admin-option-icon", "data-opt-down": "true", "aria-label": "Đưa xuống", text: "↓" }),
      h("button", { type: "button", class: "admin-option-icon admin-option-del", "data-opt-del": "true", "aria-label": "Xóa lựa chọn", text: "×" })
    ]});
  }

  function optionGroupSection(group, items, enabled) {
    var on = !!enabled;
    var body = h("div", { class: "admin-option-body", children: [
      h("div", { class: "admin-option-rows" }),
      h("button", { type: "button", class: "text-btn admin-option-add", "data-opt-add": "true", text: "+ Thêm lựa chọn" })
    ]});
    var rows = body.querySelector(".admin-option-rows");
    (items || []).forEach(function (item) { rows.appendChild(optionRow(item)); });
    var toggle = h("input", { type: "checkbox", "data-opt-enabled": "true", checked: on, "aria-label": "Bật nhóm " + group.label });
    var fold = h("button", { type: "button", class: "admin-option-fold", "data-opt-fold": "true", "aria-expanded": on ? "true" : "false", text: group.label });
    var section = h("section", {
      class: "admin-option-group" + (on ? " is-enabled is-open" : ""),
      "data-group": group.key,
      "data-enabled": on ? "true" : "false",
      children: [
        h("div", { class: "admin-option-head", children: [
          fold,
          h("label", { class: "admin-option-switch", children: [toggle, h("span", { text: "Bật" })] })
        ]}),
        body
      ]
    });
    return section;
  }

  function syncOptionsEditor(root) {
    if (!root) return "";
    var hidden = root.querySelector('textarea[name="options"]');
    var value = serializeOptionsEditor(root);
    if (hidden) hidden.value = value;
    return value;
  }

  function buildOptionsEditor(initialText) {
    var parsed = parseOptionText(initialText);
    var wrap = h("div", { class: "admin-options", "data-options-editor": "true" });
    wrap.appendChild(h("span", { class: "admin-options-label", id: "options-label", text: "Lựa chọn" }));
    wrap.appendChild(h("textarea", { name: "options", hidden: true, value: String(initialText || "") }));
    OPTION_GROUPS.forEach(function (group) {
      var items = parsed[group.key] || [];
      wrap.appendChild(optionGroupSection(group, items, items.length > 0));
    });
    wrap.appendChild(h("p", { class: "field-error", "data-error": "options" }));
    wrap.setAttribute("aria-labelledby", "options-label");

    function rowOf(el) { return el && el.closest("[data-option-row]"); }
    function rowsHost(el) {
      var section = el && el.closest("[data-group]");
      return section ? section.querySelector(".admin-option-rows") : null;
    }

    wrap.addEventListener("input", function () { syncOptionsEditor(wrap); });
    wrap.addEventListener("change", function (event) {
      var enabled = event.target.closest("[data-opt-enabled]");
      if (enabled) {
        var section = enabled.closest("[data-group]");
        var on = !!enabled.checked;
        section.setAttribute("data-enabled", on ? "true" : "false");
        section.classList.toggle("is-enabled", on);
        if (on) {
          section.classList.add("is-open");
          var fold = section.querySelector("[data-opt-fold]");
          if (fold) fold.setAttribute("aria-expanded", "true");
          var host = section.querySelector(".admin-option-rows");
          if (host && !host.children.length) host.appendChild(optionRow({ name: "", extra: 0 }));
        } else {
          section.classList.remove("is-open");
          var foldOff = section.querySelector("[data-opt-fold]");
          if (foldOff) foldOff.setAttribute("aria-expanded", "false");
        }
      }
      syncOptionsEditor(wrap);
    });
    wrap.addEventListener("click", function (event) {
      var fold = event.target.closest("[data-opt-fold]");
      if (fold) {
        var section = fold.closest("[data-group]");
        if (section.getAttribute("data-enabled") !== "true") return;
        var open = !section.classList.contains("is-open");
        section.classList.toggle("is-open", open);
        fold.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }
      var add = event.target.closest("[data-opt-add]");
      if (add) {
        var host = rowsHost(add);
        if (host) {
          host.appendChild(optionRow({ name: "", extra: 0 }));
          var input = host.lastChild.querySelector("[data-opt-name]");
          if (input) input.focus();
        }
        syncOptionsEditor(wrap);
        return;
      }
      var del = event.target.closest("[data-opt-del]");
      if (del) {
        var row = rowOf(del);
        if (row && row.parentNode) row.parentNode.removeChild(row);
        syncOptionsEditor(wrap);
        return;
      }
      var up = event.target.closest("[data-opt-up]");
      if (up) {
        var current = rowOf(up);
        if (current && current.previousElementSibling) current.parentNode.insertBefore(current, current.previousElementSibling);
        syncOptionsEditor(wrap);
        return;
      }
      var down = event.target.closest("[data-opt-down]");
      if (down) {
        var currentDown = rowOf(down);
        if (currentDown && currentDown.nextElementSibling) currentDown.parentNode.insertBefore(currentDown.nextElementSibling, currentDown);
        syncOptionsEditor(wrap);
      }
    });
    syncOptionsEditor(wrap);
    return wrap;
  }

  function findProduct(code) {
    return state.products.filter(function (product) { return product && product.code === code; })[0] || null;
  }

  function openProductForm(product) {
    var slot = $("product-form-slot");
    if (!slot) return;
    clear(slot);
    var creating = !product;
    state.editingCode = creating ? "" : product.code;
    var code = h("input", { name: "code", autocapitalize: "off", autocomplete: "off", required: creating, readOnly: !creating, value: creating ? "" : product.code });
    var name = h("input", { name: "name", required: true, value: creating ? "" : (product.name || "") });
    var price = h("input", { name: "price", type: "number", min: "0", step: "1000", inputmode: "numeric", required: true, value: creating ? "" : String(product.price == null ? "" : product.price) });
    var categoryValue = creating ? "drink" : (product.category === "food" ? "food" : product.category === "drink" ? "drink" : "");
    var category = h("select", { name: "category", children: [
      categoryValue === "" ? h("option", { value: "", text: "Chọn nhóm", selected: true }) : null,
      h("option", { value: "drink", text: "Đồ uống", selected: categoryValue === "drink" }),
      h("option", { value: "food", text: "Đồ ăn", selected: categoryValue === "food" })
    ]});
    var description = h("textarea", { name: "description", rows: "3", value: creating ? "" : (product.description || "") });
    var imageUrl = h("input", { name: "imageUrl", inputmode: "url", value: creating ? "" : (product.imageUrl || "") });
    var preview = h("img", { class: "admin-preview", alt: "Xem trước ảnh món", hidden: true });
    var optionsEditor = buildOptionsEditor(creating ? "" : (typeof product.options === "string" ? product.options : ""));
    var sortOrder = h("input", { name: "sortOrder", type: "number", step: "1", inputmode: "numeric", value: creating ? "0" : String(product.sortOrder == null ? 0 : product.sortOrder) });
    var featured = h("input", { name: "featured", type: "checkbox", checked: !creating && product.featured === true });
    var active = h("input", { name: "active", type: "checkbox", checked: creating || product.active !== false });
    var noteHint = h("input", { name: "noteHint", value: creating ? "" : (product.noteHint || "") });
    var form = h("form", { id: "product-form", class: "card", novalidate: true, children: [
      h("h2", { text: creating ? "Thêm món" : "Sửa món" }),
      field("Mã món", code, "code"),
      h("p", { class: "muted admin-help", text: creating ? "Chữ thường, số và dấu gạch ngang. Ví dụ cf-sua-da. Để trống sẽ lấy từ tên." : "Mã món không đổi sau khi tạo." }),
      field("Tên", name, "name"),
      field("Giá (đồng)", price, "price"),
      field("Nhóm", category, "category"),
      field("Mô tả", description, "description"),
      field("Ảnh (URL)", imageUrl, "imageUrl"),
      preview,
      optionsEditor,
      field("Thứ tự", sortOrder, "sortOrder"),
      field("Gợi ý ghi chú", noteHint, "noteHint"),
      h("label", { class: "checkline", children: [featured, "Nổi bật trên trang chủ"] }),
      h("label", { class: "checkline", children: [active, "Đang bán"] }),
      h("div", { class: "admin-actions", children: [
        h("button", { class: "btn btn-primary", type: "submit", text: creating ? "Thêm món" : "Lưu món" }),
        h("button", { class: "btn btn-ghost", type: "button", "data-action": "close-form", text: "Đóng" }),
        !creating && product.active !== false ? h("button", { class: "btn btn-ghost", type: "button", "data-delete": product.code, text: "Ngừng bán" }) : null
      ]})
    ]});
    slot.appendChild(form);
    bindPreview(imageUrl, preview);
    if (imageUrl._preview) imageUrl._preview();
    var auto = code.value;
    if (creating) {
      name.addEventListener("input", function () {
        if (code.value !== "" && code.value !== auto) return;
        auto = slug(name.value);
        code.value = auto;
      });
      code.addEventListener("input", function () { code.value = code.value.toLowerCase(); });
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveProduct(form, creating ? null : product);
    });
    if (slot.scrollIntoView) slot.scrollIntoView({ block: "start" });
    (creating ? name : name).focus();
  }

  function readProductForm(form) {
    var sortRaw = String(form.elements.sortOrder.value || "").trim();
    return {
      code: String(form.elements.code.value || "").trim().toLowerCase(),
      name: String(form.elements.name.value || "").trim(),
      price: form.elements.price.value === "" ? NaN : Number(form.elements.price.value),
      category: String(form.elements.category.value || ""),
      description: String(form.elements.description.value || "").trim(),
      imageUrl: String(form.elements.imageUrl.value || "").trim(),
      options: (function () { var editor = form.querySelector("[data-options-editor]"); return editor ? serializeOptionsEditor(editor) : String((form.elements.options && form.elements.options.value) || "").trim(); })(),
      sortOrder: sortRaw === "" ? 0 : Number(sortRaw),
      noteHint: String(form.elements.noteHint.value || "").trim(),
      featured: !!form.elements.featured.checked,
      active: !!form.elements.active.checked
    };
  }

  function validateProduct(edit, creating) {
    var fields = {};
    if (!edit.code) fields.code = "Nhập mã món.";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(edit.code)) fields.code = "Mã món chỉ gồm chữ thường, số và dấu gạch ngang. Ví dụ cf-sua-da.";
    else if (creating && findProduct(edit.code)) fields.code = "Mã món đã có.";
    if (!edit.name) fields.name = "Nhập tên món.";
    if (!Number.isFinite(edit.price) || edit.price < 0) fields.price = "Nhập giá là số từ 0 trở lên.";
    if (edit.category !== "drink" && edit.category !== "food") fields.category = "Chọn đồ uống hoặc đồ ăn.";
    if (!Number.isFinite(edit.sortOrder) || Math.round(edit.sortOrder) !== edit.sortOrder) fields.sortOrder = "Thứ tự phải là số nguyên.";
    if (safeImage(edit.imageUrl) == null) fields.imageUrl = "Đường dẫn ảnh không hợp lệ.";
    return fields;
  }

  function productPayload(edit, original) {
    var base = original ? JSON.parse(JSON.stringify(original)) : {};
    base.code = original ? original.code : edit.code;
    base.name = edit.name;
    base.description = edit.description;
    base.category = edit.category;
    base.categoryLabel = edit.category === "food" ? "Đồ ăn" : "Đồ uống";
    base.imageUrl = safeImage(edit.imageUrl) || "";
    base.price = Math.round(edit.price);
    base.options = edit.options;
    base.active = edit.active;
    base.sortOrder = edit.sortOrder;
    base.featured = edit.featured;
    base.noteHint = edit.noteHint;
    return base;
  }

  function rememberProduct(product) {
    var next = state.products.filter(function (item) { return item.code !== product.code; });
    next.push(product);
    state.products = next;
    renderProductList();
  }

  function saveProduct(form, original) {
    var creating = !original;
    var edit = readProductForm(form);
    if (creating && !edit.code) edit.code = slug(edit.name);
    var fields = validateProduct(edit, creating);
    applyFieldErrors(form, fields);
    if (Object.keys(fields).length) {
      showStatus($("product-status"), "Kiểm tra lại các ô được đánh dấu.", "error");
      return;
    }
    var button = form.querySelector("[type=submit]");
    button.disabled = true;
    var previous = button.textContent;
    button.textContent = "Đang lưu…";
    var payload = productPayload(edit, original);
    var path = creating ? "/api/admin/products" : "/api/admin/products/" + encodeURIComponent(original.code);
    request(creating ? "POST" : "PUT", path, payload).then(function (data) {
      var saved = data && data.code ? data : payload;
      rememberProduct(saved);
      closeProductForm();
      showStatus($("product-status"), creating ? "Đã thêm món." : "Đã lưu món.", "ok");
    }).catch(function (error) {
      if (error && error.auth) return;
      if (error && error.fields) applyFieldErrors(form, error.fields);
      showStatus($("product-status"), (error && error.message) || "Không lưu được món.", "error");
    }).finally(function () {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = previous;
      }
    });
  }

  function closeProductForm() {
    state.editingCode = "";
    var slot = $("product-form-slot");
    if (slot) clear(slot);
  }

  function toggleProduct(code, button) {
    var product = findProduct(code);
    if (!product) return;
    if (button) button.disabled = true;
    var payload = JSON.parse(JSON.stringify(product));
    payload.active = product.active === false;
    request("PUT", "/api/admin/products/" + encodeURIComponent(code), payload).then(function (data) {
      var saved = data && data.code ? data : payload;
      rememberProduct(saved);
      var form = $("product-form");
      if (form && state.editingCode === code && form.elements.active) form.elements.active.checked = saved.active !== false;
      showStatus($("product-status"), saved.active === false ? "Đã ngừng bán." : "Đã bật bán lại.", "ok");
    }).catch(function (error) {
      if (button) button.disabled = false;
      if (error && error.auth) return;
      showStatus($("product-status"), (error && error.message) || "Không đổi được trạng thái món.", "error");
    });
  }

  function deleteProduct(code) {
    var product = findProduct(code);
    if (!product) return;
    var name = product.name || code;
    if (!window.confirm("Ngừng bán \"" + name + "\"? Món sẽ không hiện trên thực đơn. Có thể bán lại sau.")) return;
    showStatus($("product-status"), "Đang ngừng bán…", "busy");
    request("DELETE", "/api/admin/products/" + encodeURIComponent(code)).then(function (data) {
      var saved = data && data.code ? data : JSON.parse(JSON.stringify(product));
      saved.active = false;
      rememberProduct(saved);
      if (state.editingCode === code) closeProductForm();
      showStatus($("product-status"), "Đã ngừng bán " + name + ".", "ok");
    }).catch(function (error) {
      if (error && error.auth) return;
      showStatus($("product-status"), (error && error.message) || "Không ngừng bán được.", "error");
    });
  }

  function ordersPanel() {
    return h("section", { id: "panel-orders", role: "tabpanel", "aria-labelledby": "tab-orders", hidden: true, children: [
      h("p", { id: "order-status", class: "admin-busy", hidden: true }),
      h("div", { class: "admin-filters", children: [
        filterChip("", "Tất cả"),
        filterChip("NEW", "Mới"),
        filterChip("ACCEPTED", "Đã nhận"),
        filterChip("DONE", "Hoàn tất"),
        filterChip("CANCELLED", "Đã hủy")
      ]}),
      h("div", { class: "admin-actions", children: [
        h("button", { type: "button", class: "btn btn-ghost", "data-action": "refresh-orders", text: "Làm mới" })
      ]}),
      h("p", { id: "order-refresh", class: "admin-muted", hidden: true }),
      h("div", { id: "order-list" })
    ]});
  }

  function filterChip(status, label) {
    return h("button", {
      type: "button",
      class: "chip" + (status === "" ? " is-active" : ""),
      "data-filter-status": status,
      "aria-pressed": status === "" ? "true" : "false",
      text: label
    });
  }

  function ordersPath(status) {
    var params = new URLSearchParams();
    params.set("status", status || "");
    params.set("limit", "50");
    return "/api/admin/orders?" + params.toString();
  }

  function ensureOrders() {
    loadOrders({ silent: state.orders.length > 0 });
  }

  function loadOrders(opts) {
    var silent = opts && opts.silent;
    var seq = ++orderSeq;
    var status = state.orderFilter || "";
    state.ordersLoading = true;
    if (!silent) showStatus($("order-status"), "Đang tải đơn hàng…", "busy");
    return request("GET", ordersPath(status)).then(function (data) {
      if (seq !== orderSeq || state.view !== "app") return;
      if (!Array.isArray(data)) throw fail("Không đọc được danh sách đơn.");
      state.orders = data;
      if (!silent) showStatus($("order-status"), "", "busy");
      showStatus($("order-refresh"), "Cập nhật lúc " + formatWhen(new Date()) + ".", "muted");
      if (silent && focusInsideOrders()) state.ordersStale = true;
      else {
        state.ordersStale = false;
        renderOrderList();
      }
    }).catch(function (error) {
      if (seq !== orderSeq || (error && error.auth)) return;
      showStatus($("order-status"), (error && error.message) || NETWORK, "error", function () { loadOrders({ silent: false }); });
    }).finally(function () {
      if (seq === orderSeq) state.ordersLoading = false;
    });
  }

  function focusInsideOrders() {
    var active = document.activeElement;
    var list = $("order-list");
    return !!(active && list && list.contains(active));
  }

  function viewOrder(raw) {
    raw = raw || {};
    var customer = raw.customer || {};
    var items = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.lines) ? raw.lines : []);
    return {
      code: raw.code || raw.id || "",
      createdAt: raw.createdAt || raw.placedAt || "",
      customerName: raw.customerName || customer.name || "",
      phone: raw.phone || customer.phone || "",
      address: raw.address || "",
      deliveryType: raw.deliveryType || raw.fulfillment || "",
      paymentMethod: raw.paymentMethod || raw.payment || "",
      note: raw.note || "",
      items: items.map(viewItem),
      subtotal: Number(raw.subtotal) || 0,
      deliveryFee: Number(raw.deliveryFee) || 0,
      total: Number(raw.total) || 0,
      status: raw.status || ""
    };
  }

  function viewItem(raw) {
    raw = raw || {};
    return {
      productName: raw.productName || raw.name || "",
      quantity: Number(raw.quantity) || 0,
      unitPrice: Number(raw.unitPrice) || 0,
      size: raw.size || raw.sizeLabel || "",
      sugar: raw.sugar || raw.sugarLabel || "",
      ice: raw.ice || raw.iceLabel || "",
      toppings: splitList(raw.toppings || raw.toppingLabels),
      note: raw.note || ""
    };
  }

  function orderedOrders() {
    var copy = state.orders.slice();
    var dated = copy.every(function (order) {
      return order && order.createdAt && !Number.isNaN(new Date(order.createdAt).getTime());
    });
    if (!dated) return copy;
    copy.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return copy;
  }

  function renderOrderList() {
    var host = $("order-list");
    if (!host) return;
    clear(host);
    var orders = orderedOrders().map(viewOrder);
    if (!orders.length) {
      host.appendChild(h("div", { class: "empty", children: [
        h("h2", { text: "Chưa có đơn" }),
        h("p", { text: state.orderFilter ? "Không có đơn ở trạng thái này." : "Đơn mới sẽ hiện ở đây." })
      ]}));
      return;
    }
    orders.forEach(function (order) { host.appendChild(orderCard(order)); });
  }

  function itemBits(item) {
    var bits = [];
    if (item.size) bits.push(item.size);
    if (item.sugar) bits.push("Đường " + item.sugar);
    if (item.ice) bits.push(/đá/i.test(item.ice) ? item.ice : "Đá " + item.ice);
    if (item.toppings.length) bits.push(item.toppings.join(", "));
    if (item.note) bits.push(item.note);
    return bits.join(" · ");
  }

  function lineMoney(item) {
    return (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
  }

  function orderCard(order) {
    var open = state.expandedOrder === order.code;
    var summary = h("button", {
      type: "button",
      class: "admin-order-open",
      "data-expand": order.code,
      "aria-expanded": open ? "true" : "false",
      children: [
        h("span", { class: "history-meta", children: [
          h("strong", { text: order.code || "Đơn" }),
          h("span", { class: "price", text: formatVnd(order.total) })
        ]}),
        h("span", { class: "muted", text: formatWhen(order.createdAt) }),
        h("span", { text: [order.customerName, order.phone].filter(Boolean).join(" · ") }),
        h("span", { class: "pill admin-status", text: statusLabel(order.status) })
      ]
    });
    return h("article", { class: "card admin-order", children: [summary, open ? orderDetail(order) : null] });
  }

  function orderDetail(order) {
    var phone = String(order.phone || "").replace(/[^\d+]/g, "");
    var rows = [
      row("Khách", order.customerName || "—"),
      phone ? h("div", { class: "bank-row", children: [
        h("span", { text: "Điện thoại" }),
        h("a", { href: "tel:" + phone, text: order.phone })
      ]}) : row("Điện thoại", "—"),
      row("Nhận món", DELIVERY[order.deliveryType] || order.deliveryType || "—"),
      order.address ? row("Địa chỉ", order.address) : null,
      row("Thanh toán", PAYMENT[order.paymentMethod] || order.paymentMethod || "—"),
      order.note ? row("Ghi chú", order.note) : null
    ];
    var lines = order.items.length
      ? h("ul", { class: "admin-lines", children: order.items.map(function (item) {
        return h("li", { children: [
          h("span", { children: [
            document.createTextNode((item.quantity || 0) + " × " + (item.productName || "Món")),
            itemBits(item) ? h("small", { class: "muted", text: itemBits(item) }) : null
          ]}),
          h("strong", { text: formatVnd(lineMoney(item)) })
        ]});
      }) })
      : h("p", { class: "muted", text: "Không có dòng món." });
    var statusButtons = ORDER_STATUS.map(function (item) {
      var current = item.id === order.status;
      return h("button", {
        type: "button",
        class: "admin-status-btn" + (current ? " is-current" : ""),
        "data-set-status": item.id,
        "data-order-code": order.code,
        disabled: current,
        "aria-pressed": current ? "true" : "false",
        text: item.label
      });
    });
    return h("div", { class: "admin-detail", children: rows.concat([
      h("h3", { text: "Món" }),
      lines,
      h("div", { class: "totals", children: [
        h("div", { children: [h("span", { text: "Tạm tính" }), h("strong", { text: formatVnd(order.subtotal) })] }),
        h("div", { children: [h("span", { text: "Phí giao hàng" }), h("strong", { text: formatVnd(order.deliveryFee) })] }),
        h("div", { class: "grand", children: [h("span", { text: "Tổng" }), h("strong", { text: formatVnd(order.total) })] })
      ]}),
      h("p", { class: "admin-status-legend", text: "Trạng thái" }),
      h("div", { class: "admin-status-grid", role: "group", "aria-label": "Trạng thái đơn " + (order.code || ""), children: statusButtons })
    ]) });
  }

  function row(label, value) {
    return h("div", { class: "bank-row", children: [h("span", { text: label }), h("strong", { text: value })] });
  }

  function setOrderFilter(status) {

    state.orderFilter = status;
    document.querySelectorAll("[data-filter-status]").forEach(function (button) {
      var on = (button.getAttribute("data-filter-status") || "") === status;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    loadOrders({ silent: false });
  }

  function saveOrderStatus(code, status, button) {
    var order = state.orders.map(viewOrder).filter(function (item) { return item.code === code; })[0];
    if (order && order.status === status) return;
    if (ORDER_STATUS.every(function (item) { return item.id !== status; })) {
      showStatus($("order-status"), "Chọn trạng thái hợp lệ.", "error");
      return;
    }
    if (status === "CANCELLED" && !window.confirm("Hủy đơn " + code + "? Đơn sẽ chuyển sang Đã hủy.")) return;
    var group = button && button.closest(".admin-status-grid");
    var buttons = group ? group.querySelectorAll("button") : (button ? [button] : []);
    Array.prototype.forEach.call(buttons, function (item) { item.disabled = true; });
    request("PATCH", "/api/admin/orders/" + encodeURIComponent(code), { status: status }).then(function (data) {
      state.orders = state.orders.map(function (item) {
        var id = item && (item.code || item.id);
        if (id !== code) return item;
        var next = data && (data.code || data.id) ? data : JSON.parse(JSON.stringify(item));
        next.status = (data && data.status) || status;
        return next;
      });
      renderOrderList();
      showStatus($("order-status"), "Đã cập nhật trạng thái " + code + " thành " + statusLabel(status) + ".", "ok");
    }).catch(function (error) {
      var current = order ? order.status : "";
      Array.prototype.forEach.call(buttons, function (item) {
        item.disabled = item.getAttribute("data-set-status") === current;
      });
      if (error && error.auth) return;
      showStatus($("order-status"), (error && error.message) || "Không cập nhật được trạng thái.", "error");
    });
  }

  function startOrderRefresh() {
    stopOrderRefresh();
    orderTimer = setInterval(function () {
      if (state.tab !== "orders" || document.hidden) return;
      loadOrders({ silent: true });
    }, ORDER_REFRESH_MS);
  }

  function stopOrderRefresh() {
    if (orderTimer) clearInterval(orderTimer);
    orderTimer = 0;
  }

  function onClick(event) {
    var tab = event.target.closest("[data-tab]");
    if (tab) { selectTab(tab.getAttribute("data-tab")); return; }
    var edit = event.target.closest("[data-edit]");
    if (edit) { openProductForm(findProduct(edit.getAttribute("data-edit"))); return; }
    var toggle = event.target.closest("[data-toggle]");
    if (toggle) { toggleProduct(toggle.getAttribute("data-toggle"), toggle); return; }
    var remove = event.target.closest("[data-delete]");
    if (remove) { deleteProduct(remove.getAttribute("data-delete")); return; }
    var action = event.target.closest("[data-action]");
    if (action) {
      var name = action.getAttribute("data-action");
      if (name === "add-product") openProductForm(null);
      if (name === "close-form") closeProductForm();
      if (name === "refresh-orders") loadOrders({ silent: false });
      return;
    }
    var filter = event.target.closest("[data-filter-status]");
    if (filter) { setOrderFilter(filter.getAttribute("data-filter-status") || ""); return; }
    var expand = event.target.closest("[data-expand]");
    if (expand) {
      var code = expand.getAttribute("data-expand");
      state.expandedOrder = state.expandedOrder === code ? "" : code;
      renderOrderList();
      return;
    }
    var setStatus = event.target.closest("[data-set-status]");
    if (setStatus) {
      saveOrderStatus(setStatus.getAttribute("data-order-code"), setStatus.getAttribute("data-set-status"), setStatus);
      return;
    }
  }

  function boot() {
    var root = $("admin-app");
    root.addEventListener("click", onClick);
    root.addEventListener("submit", function (event) {
      if (event.target && event.target.id === "shop-form") {
        event.preventDefault();
        saveShop(event.target);
      }
    });
    root.addEventListener("focusout", function () {
      if (!state.ordersStale) return;
      setTimeout(function () {
        if (focusInsideOrders()) return;
        state.ordersStale = false;
        if (state.tab === "orders") renderOrderList();
      }, 0);
    });
    var logout = $("admin-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        clearSession();
        stopOrderRefresh();
        showLogin("Đã đăng xuất.");
      });
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.view === "app" && state.tab === "orders") loadOrders({ silent: true });
    });
    setInterval(function () {
      if (state.view === "app" && !sessionValid()) endSession(SESSION_EXPIRED);
    }, 15000);
    var raw = readRawSession();
    if (raw.blocked) {
      showLogin(LOGIN_FAILED);
      return;
    }
    if (sessionValid()) {
      state.sawSession = true;
      showApp();
      return;
    }
    if (raw.token) {
      clearSession();
      showLogin(SESSION_EXPIRED);
      return;
    }
    showLogin("");
  }

  boot();
})();
