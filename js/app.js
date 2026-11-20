(function () {
  "use strict";

  const CART_KEY = "abeos-house:cart";
  const ORDERS_KEY = "abeos-house:orders";

  const FULFILLMENT = {
    delivery: "Giao hàng",
    pickup: "Mang về",
    dinein: "Dùng tại quán"
  };

  const PAYMENT = {
    cash: "Tiền mặt khi nhận",
    transfer: "Chuyển khoản"
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
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
    const rounded = Math.round(Number(amount) || 0);
    const sign = rounded < 0 ? "−" : "";
    const digits = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + digits + "đ";
  }

  function shop() {
    return (window.App && App.SHOP) || {};
  }

  function menu() {
    return (window.App && App.MENU) || [];
  }

  function findItem(id) {
    return menu().find(function (item) { return item.id === id; }) || null;
  }

  function categoryLabel(id) {
    const categories = (window.App && App.CATEGORIES) || [];
    const found = categories.find(function (category) { return category.id === id; });
    return found ? found.label : "";
  }

  function itemOptions(item) {
    if (window.App && App.ensureOptions) return App.ensureOptions(item);
    return (item && item.options) || { sizes: [], sugar: [], ice: [], toppings: [] };
  }

  function sizeText(item, sizeId) {
    const options = itemOptions(item);
    const found = (options.sizes || []).find(function (size) { return size.id === sizeId || size.label === sizeId; });
    return found ? found.label : sizeId;
  }

  function unitPrice(item, sizeId, toppingIds) {
    itemOptions(item);
    if (window.App && App.lineUnitPrice) return App.lineUnitPrice(item, sizeId, toppingIds);
    return Number(item.price) || 0;
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function loadCart() {
    const parsed = loadJson(CART_KEY, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function (line) {
      return line && line.lineId && line.itemId && line.quantity > 0;
    });
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadges(cart);
  }

  function loadOrders() {
    const parsed = loadJson(ORDERS_KEY, {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }

  function cartCount(cart) {
    return cart.reduce(function (sum, line) { return sum + Number(line.quantity || 0); }, 0);
  }

  function lineTotal(line) {
    return Number(line.unitPrice || 0) * Number(line.quantity || 0);
  }

  function subtotal(cart) {
    return cart.reduce(function (sum, line) { return sum + lineTotal(line); }, 0);
  }

  function deliveryFeeFor(method) {
    if (method !== "delivery") return 0;
    const fee = Number(shop().deliveryFee);
    return Number.isFinite(fee) ? fee : 0;
  }

  function updateBadges(cart) {
    const count = cartCount(cart || loadCart());
    $all("[data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
      el.classList.toggle("is-zero", count === 0);
    });
  }

  function itemHaystack(item) {
    return fold([item.name, item.blurb, categoryLabel(item.category)].join(" "));
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Math.random().toString(36).slice(2, 10);
  }

  function signature(line) {
    const toppings = (line.toppingIds || []).slice().sort().join(",");
    return [line.itemId, line.size, line.sugar || "", line.ice || "", toppings, (line.note || "").trim()].join("|");
  }

  function optionSummary(line) {
    const parts = [];
    if (line.sizeLabel) parts.push(line.sizeLabel);
    if (line.sugarLabel) parts.push("Đường " + line.sugarLabel);
    if (line.iceLabel) parts.push(line.iceLabel);
    if (line.toppingLabels && line.toppingLabels.length) parts.push(line.toppingLabels.join(", "));
    if (line.note) parts.push("Ghi chú: " + line.note);
    return parts.join(" · ");
  }

  function photoHtml(item, className) {
    if (!item || !item.image) return "";
    return '<img class="' + className + '" src="' + esc(item.image) + '" alt="">';
  }

  function cardHtml(item) {
    const popular = item.popular ? ' <span class="pill">Hay gọi</span>' : "";
    return (
      '<article class="item-card">' +
        photoHtml(item, "item-photo") +
        "<div>" +
          '<p class="item-kicker">' + esc(categoryLabel(item.category)) + popular + "</p>" +
          "<h3>" + esc(item.name) + "</h3>" +
          "<p>" + esc(item.blurb) + "</p>" +
          '<div class="item-row">' +
            '<div><div class="price">' + formatVnd(item.price) + '</div><div class="price-note">Cỡ vừa</div></div>' +
            '<button type="button" class="add-btn" data-open-item="' + esc(item.id) + '">Thêm</button>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function bindShop() {
    const info = shop();
    $all("[data-bind]").forEach(function (el) {
      const key = el.getAttribute("data-bind");
      if (key === "deliveryFee") {
        el.textContent = formatVnd(info.deliveryFee || 0);
        return;
      }
      if (info[key] != null && String(info[key]) !== "") el.textContent = info[key];
    });
    var hero = document.querySelector(".polaroid img");
    if (hero && info.heroImage) {
      hero.src = info.heroImage;
      if (info.heroCaption) hero.alt = info.heroCaption;
    }
    $all("[data-bind-phone]").forEach(function (el) {
      if (el.hasAttribute("data-phone-prefix")) {
        const prefix = el.getAttribute("data-phone-prefix");
        el.textContent = (prefix ? prefix + " " : "") + (info.phone || "");
      }
      if (info.phoneTel) el.setAttribute("href", "tel:" + info.phoneTel);
    });
    const mapLink = $("[data-map-link]");
    if (mapLink && info.address) {
      mapLink.setAttribute("href", "https://maps.google.com/?q=" + encodeURIComponent(info.address));
    }
  }

  function renderHome() {
    const featured = $("#featured");
    if (!featured) return;
    const items = menu().filter(function (item) { return item.popular; });
    featured.innerHTML = items.map(cardHtml).join("");
  }

  function renderMenu() {
    const root = $("#menu-app");
    if (!root) return;
    const categories = (App.CATEGORIES || []);
    const chips = ['<button type="button" class="chip is-active" data-category="all" aria-pressed="true">Tất cả</button>']
      .concat(categories.map(function (category) {
        const count = menu().filter(function (item) { return item.category === category.id; }).length;
        return '<button type="button" class="chip" data-category="' + esc(category.id) + '" aria-pressed="false">' +
          esc(category.label) + " · " + count + "</button>";
      }))
      .join("");

    root.innerHTML =
      '<div class="menu-toolbar">' +
        '<input id="menu-search" class="search" type="search" placeholder="Tìm cà phê, trà, bánh mì…" autocomplete="off" aria-label="Tìm món">' +
        '<div class="chips" role="group" aria-label="Nhóm món">' + chips + "</div>" +
        '<p class="count-line"><span data-result-count>0</span> món</p>' +
      "</div>" +
      '<div class="grid cols-2" id="menu-grid"></div>';

    const input = $("#menu-search", root);
    const grid = $("#menu-grid", root);
    let category = "all";

    function apply() {
      const query = fold(input.value);
      const items = menu().filter(function (item) {
        if (category !== "all" && item.category !== category) return false;
        if (!query) return true;
        return itemHaystack(item).includes(query);
      });
      $("[data-result-count]", root).textContent = String(items.length);
      grid.innerHTML = items.length
        ? items.map(cardHtml).join("")
        : '<div class="empty" role="status"><h2>Không thấy món</h2><p>Thử từ khác, ví dụ “cà phê” hoặc “bánh”. Không cần gõ dấu.</p></div>';
    }

    input.addEventListener("input", apply);
    $(".chips", root).addEventListener("click", function (event) {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      category = button.getAttribute("data-category");
      $all("[data-category]", root).forEach(function (el) {
        const on = el === button;
        el.classList.toggle("is-active", on);
        el.setAttribute("aria-pressed", on ? "true" : "false");
      });
      apply();
    });
    apply();
  }

  function ensureModal() {
    let modal = $("#item-modal");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend",
      '<div class="modal" id="item-modal" hidden role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<button type="button" class="modal-backdrop" data-close aria-label="Đóng"></button>' +
        '<div class="modal-sheet" id="modal-sheet"></div>' +
      "</div>"
    );
    modal = $("#item-modal");
    modal.addEventListener("click", onModalClick);
    modal.addEventListener("input", updateModalPrice);
    modal.addEventListener("change", updateModalPrice);
    return modal;
  }

  function choiceHtml(name, value, label, checked) {
    return '<label class="choice"><input type="' + (name === "topping" ? "checkbox" : "radio") +
      '" name="' + name + '" value="' + esc(value) + '"' + (checked ? " checked" : "") + "> " +
      esc(label) + "</label>";
  }

  function openModal(itemId) {
    const item = findItem(itemId);
    if (!item) return;
    const modal = ensureModal();
    const sheet = $("#modal-sheet");
    const isDrink = item.category === "drink";
    const options = itemOptions(item);
    const sizeDefault = App.defaultChoiceId(options.sizes, function (size) { return Number(size.extra) === 0; });
    const sugarDefault = App.defaultChoiceId(options.sugar, function (level) { return level.label === "70%"; });
    const iceDefault = App.defaultChoiceId(options.ice, function (level) { return fold(level.label) === "binh thuong"; });
    const sizes = (options.sizes || []).map(function (size) {
      const delta = size.extra ? " " + (size.extra > 0 ? "+" : "−") + formatVnd(Math.abs(size.extra)) : "";
      return choiceHtml("size", size.id, size.label + delta, size.id === sizeDefault);
    }).join("");
    const sugar = (options.sugar || []).map(function (level) {
      return choiceHtml("sugar", level.id, level.label, level.id === sugarDefault);
    }).join("");
    const ice = (options.ice || []).map(function (level) {
      return choiceHtml("ice", level.id, level.label, level.id === iceDefault);
    }).join("");
    const toppings = (options.toppings || []).map(function (topping) {
      return choiceHtml("topping", topping.id, topping.label + " +" + formatVnd(topping.price), false);
    }).join("");
    const hint = item.noteHint || (isDrink ? "Ví dụ: ít ngọt, không đá viên" : "Ghi chú cho quán");

    sheet.innerHTML =
      '<div class="grabber" aria-hidden="true"></div>' +
      '<div class="modal-head">' +
        '<div class="modal-photo">' + photoHtml(item, "item-photo") + "</div>" +
        '<div><p class="item-kicker">' + esc(categoryLabel(item.category)) + "</p>" +
        '<h2 id="modal-title">' + esc(item.name) + "</h2></div>" +
        '<button type="button" class="close-btn" data-close aria-label="Đóng">×</button>' +
      "</div>" +
      '<div class="modal-body">' +
        "<p>" + esc(item.blurb) + "</p>" +
        (sizes ? '<div class="option-block"><h3>' + (isDrink ? "Cỡ ly" : "Khẩu phần") + '</h3><div class="choice-row">' + sizes + "</div></div>" : "") +
        (sugar ? '<div class="option-block"><h3>Đường</h3><div class="choice-row">' + sugar + "</div></div>" : "") +
        (ice ? '<div class="option-block"><h3>Đá</h3><div class="choice-row">' + ice + "</div></div>" : "") +
        (toppings ? '<div class="option-block"><h3>Topping</h3><div class="choice-row">' + toppings + "</div></div>" : "") +
        '<div class="option-block"><h3>Số lượng</h3><div class="qty">' +
          '<button type="button" data-qty-dec aria-label="Giảm số lượng">−</button>' +
          '<span data-qty-value>1</span>' +
          '<button type="button" data-qty-inc aria-label="Tăng số lượng">+</button>' +
        "</div></div>" +
        '<div class="option-block"><h3>Ghi chú</h3>' +
          '<textarea class="note-field" data-note maxlength="140" placeholder="' + esc(hint) + '"></textarea>' +
        "</div>" +
      "</div>" +
      '<div class="modal-footer"><div><div class="muted">Tạm tính</div><div class="price" data-modal-price></div></div>' +
        '<button type="button" class="btn btn-primary" data-add>Thêm vào giỏ</button></div>';

    sheet.dataset.itemId = item.id;
    sheet.dataset.qty = "1";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    updateModalPrice();
    const close = $("[data-close]", sheet);
    if (close) close.focus();
  }

  function closeModal() {
    const modal = $("#item-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function readSelection(sheet) {
    const item = findItem(sheet.dataset.itemId);
    if (!item) return null;
    const options = itemOptions(item);
    const sizeInput = $('input[name="size"]:checked', sheet);
    const sugarInput = $('input[name="sugar"]:checked', sheet);
    const iceInput = $('input[name="ice"]:checked', sheet);
    const toppingIds = $all('input[name="topping"]:checked', sheet).map(function (input) { return input.value; });
    const sizeId = sizeInput ? sizeInput.value : ((options.sizes[0] && options.sizes[0].id) || "");
    const sugar = sugarInput ? (options.sugar || []).find(function (level) { return level.id === sugarInput.value; }) : null;
    const ice = iceInput ? (options.ice || []).find(function (level) { return level.id === iceInput.value; }) : null;
    const toppings = (options.toppings || []).filter(function (topping) {
      return toppingIds.indexOf(topping.id) !== -1;
    });
    const note = ($("[data-note]", sheet).value || "").trim().slice(0, 140);
    const quantity = Math.max(1, Math.min(20, Number(sheet.dataset.qty) || 1));
    return {
      lineId: uid(),
      itemId: item.id,
      name: item.name,
      image: item.image || "",
      size: sizeId,
      sizeLabel: sizeText(item, sizeId),
      sugar: sugar ? sugar.id : "",
      sugarLabel: sugar ? sugar.label : "",
      ice: ice ? ice.id : "",
      iceLabel: ice ? ice.label : "",
      toppingIds: toppings.map(function (topping) { return topping.id; }),
      toppingLabels: toppings.map(function (topping) { return topping.label || topping.name; }),
      note: note,
      quantity: quantity,
      unitPrice: unitPrice(item, sizeId, toppingIds)
    };
  }

  function updateModalPrice() {
    const sheet = $("#modal-sheet");
    if (!sheet || !sheet.dataset.itemId) return;
    const selection = readSelection(sheet);
    const price = $("[data-modal-price]", sheet);
    if (selection && price) price.textContent = formatVnd(selection.unitPrice * selection.quantity);
  }

  function setQty(delta) {
    const sheet = $("#modal-sheet");
    const next = Math.max(1, Math.min(20, (Number(sheet.dataset.qty) || 1) + delta));
    sheet.dataset.qty = String(next);
    $("[data-qty-value]", sheet).textContent = String(next);
    updateModalPrice();
  }

  function showToast(message) {
    let toast = $("#toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.hidden = true; }, 2200);
  }

  function addCurrentItem() {
    const sheet = $("#modal-sheet");
    const selection = readSelection(sheet);
    if (!selection) return;
    const cart = loadCart();
    const sig = signature(selection);
    const existing = cart.find(function (line) { return signature(line) === sig; });
    if (existing) existing.quantity = Math.min(20, existing.quantity + selection.quantity);
    else cart.push(selection);
    saveCart(cart);
    closeModal();
    showToast("Đã thêm " + selection.quantity + " × " + selection.name);
  }

  function onModalClick(event) {
    if (event.target.closest("[data-close]")) {
      closeModal();
      return;
    }
    if (event.target.closest("[data-qty-dec]")) setQty(-1);
    if (event.target.closest("[data-qty-inc]")) setQty(1);
    if (event.target.closest("[data-add]")) addCurrentItem();
  }

  function trapModalTab(event) {
    const modal = $("#item-modal");
    if (!modal || modal.hidden || event.key !== "Tab") return;
    const focusable = $all("button, input, textarea, a", modal).filter(function (el) {
      return !el.disabled && el.tabIndex !== -1;
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderCart() {
    const root = $("#cart-app");
    if (!root) return;
    const cart = loadCart();
    const lead = $("#cart-lead");
    if (!cart.length) {
      if (lead) lead.textContent = "Giỏ đang trống.";
      root.innerHTML =
        '<div class="empty"><h2>Chưa có món nào</h2><p>Chọn một ly hoặc một phần ăn ở thực đơn.</p>' +
        '<p class="stack-actions" style="justify-content:center"><a class="btn btn-primary" href="menu.html">Mở thực đơn</a></p></div>';
      return;
    }
    if (lead) lead.textContent = cartCount(cart) + " món, lưu trên máy này.";
    const lines = cart.map(function (line) {
      return (
        '<article class="cart-line' + (line.image ? " has-photo" : "") + '">' +
          (line.image ? '<img class="line-photo" src="' + esc(line.image) + '" alt="">' : "") +
          "<div>" +
            "<h3>" + esc(line.name) + "</h3>" +
            '<p class="muted">' + esc(optionSummary(line)) + "</p>" +
            '<div class="line-actions">' +
              '<div class="qty">' +
                '<button type="button" data-cart-action="dec" data-line-id="' + esc(line.lineId) + '" aria-label="Giảm số lượng">−</button>' +
                "<span>" + esc(line.quantity) + "</span>" +
                '<button type="button" data-cart-action="inc" data-line-id="' + esc(line.lineId) + '" aria-label="Tăng số lượng">+</button>' +
              "</div>" +
              "<strong class=\"price\">" + formatVnd(lineTotal(line)) + "</strong>" +
            "</div>" +
            '<div class="line-actions">' +
              '<span class="muted">' + formatVnd(line.unitPrice) + " × " + esc(line.quantity) + "</span>" +
              '<button type="button" class="text-btn" data-cart-action="remove" data-line-id="' + esc(line.lineId) + '">Xóa</button>' +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");
    const fee = deliveryFeeFor("delivery");
    root.innerHTML =
      lines +
      '<div class="card summary">' +
        '<div class="totals"><div><span>Tạm tính</span><strong>' + formatVnd(subtotal(cart)) + "</strong></div></div>" +
        '<p class="muted" style="margin-top:8px">Phí giao hàng ' + formatVnd(fee) + " được cộng nếu chọn giao ở bước thanh toán. Mang về và dùng tại quán không tính phí.</p>" +
        '<p class="stack-actions"><a class="btn btn-primary" href="checkout.html">Thanh toán</a><a class="btn btn-ghost" href="menu.html">Thêm món</a></p>' +
      "</div>";
  }

  function updateCartLine(action, lineId) {
    const cart = loadCart();
    const line = cart.find(function (item) { return item.lineId === lineId; });
    if (!line) return;
    if (action === "remove") saveCart(cart.filter(function (item) { return item.lineId !== lineId; }));
    else {
      if (action === "inc") line.quantity = Math.min(20, line.quantity + 1);
      if (action === "dec") line.quantity = Math.max(1, line.quantity - 1);
      saveCart(cart);
    }
    if (document.body.dataset.page === "cart") {
      renderCart();
      const again = document.querySelector('[data-cart-action="' + action + '"][data-line-id="' + CSS.escape(lineId) + '"]');
      if (again) again.focus();
    }
  }

  function selectedValue(form, name, fallback) {
    const input = form.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : fallback;
  }

  function setFieldError(form, name, message) {
    const slot = form.querySelector('[data-error="' + name + '"]');
    if (slot) slot.textContent = message || "";
    const field = form.elements[name];
    if (field && field.setAttribute) field.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function normalizePhone(value) {
    const compact = String(value || "").replace(/[\s.\-]/g, "");
    if (/^0\d{9}$/.test(compact)) return compact;
    if (/^\+84\d{9}$/.test(compact)) return "0" + compact.slice(3);
    if (/^84\d{9}$/.test(compact)) return "0" + compact.slice(2);
    return "";
  }

  function prettyPhone(digits) {
    if (!digits || digits.length !== 10) return digits || "";
    return digits.slice(0, 4) + " " + digits.slice(4, 7) + " " + digits.slice(7);
  }

  function renderSummary(cart, method) {
    const fee = deliveryFeeFor(method);
    const lines = cart.map(function (line) {
      return "<div><span>" + esc(line.quantity) + " × " + esc(line.name) + "</span><strong>" + formatVnd(lineTotal(line)) + "</strong></div>";
    }).join("");
    return (
      '<div class="card summary">' +
        '<h2 class="summary-title">Đơn của bạn</h2>' +
        '<div class="totals">' + lines +
          "<div><span>Tạm tính</span><strong>" + formatVnd(subtotal(cart)) + "</strong></div>" +
          "<div><span>Phí giao hàng</span><strong>" + formatVnd(fee) + "</strong></div>" +
          '<div class="grand"><span>Tổng</span><strong>' + formatVnd(subtotal(cart) + fee) + "</strong></div>" +
        "</div></div>"
    );
  }

  function refreshCheckoutSummary() {
    const form = $("#checkout-form");
    const slot = $("#checkout-summary");
    if (!form || !slot) return;
    const method = selectedValue(form, "fulfillment", "delivery");
    const address = $("#address-field");
    if (address) address.hidden = method !== "delivery";
    const payment = selectedValue(form, "payment", "cash");
    const bank = $("#bank-preview");
    if (bank) bank.hidden = payment !== "transfer";
    slot.innerHTML = renderSummary(loadCart(), method);
  }

  function renderCheckout() {
    const root = $("#checkout-app");
    if (!root) return;
    const cart = loadCart();
    if (!cart.length) {
      root.innerHTML =
        '<div class="empty"><h2>Giỏ đang trống</h2><p>Thêm món trước khi thanh toán.</p>' +
        '<p class="stack-actions" style="justify-content:center"><a class="btn btn-primary" href="menu.html">Mở thực đơn</a></p></div>';
      return;
    }
    const info = shop();
    const bank = info.bank || {};
    const scriptReady = window.App && App.SHEETS && String(App.SHEETS.scriptUrl || "").trim();
    root.innerHTML =
      '<form id="checkout-form" class="checkout-layout" novalidate>' +
        "<div>" +
          (scriptReady ? "" : '<p class="notice">Chưa nối đơn tới Google Sheet. Đặt món sẽ báo lỗi cho đến khi dán link Apps Script trong js/config.js.</p>') +
          '<label class="field">Họ tên<input name="name" autocomplete="name" maxlength="80" required></label>' +
          '<p class="field-error" data-error="name"></p>' +
          '<label class="field">Số điện thoại<input name="phone" inputmode="tel" autocomplete="tel" maxlength="16" required></label>' +
          '<p class="field-error" data-error="phone"></p>' +
          "<fieldset><legend>Nhận món</legend>" +
            '<label class="option-card"><input type="radio" name="fulfillment" value="delivery" checked><span>Giao hàng<small>Phí ' + formatVnd(info.deliveryFee || 0) + "</small></span></label>" +
            '<label class="option-card"><input type="radio" name="fulfillment" value="pickup"><span>Mang về<small>Không phí giao</small></span></label>' +
            '<label class="option-card"><input type="radio" name="fulfillment" value="dinein"><span>Dùng tại quán<small>Không phí giao</small></span></label>' +
          "</fieldset>" +
          '<div id="address-field"><label class="field">Địa chỉ giao<input name="address" autocomplete="street-address" maxlength="180"></label>' +
          '<p class="field-error" data-error="address"></p></div>' +
          '<label class="field">Ghi chú cho quán<textarea name="note" maxlength="240" placeholder="Ví dụ: gọi trước khi giao"></textarea></label>' +
          "<fieldset><legend>Thanh toán</legend>" +
            '<label class="option-card"><input type="radio" name="payment" value="cash" checked><span>Tiền mặt khi nhận<small>Trả khi lấy món</small></span></label>' +
            '<label class="option-card"><input type="radio" name="payment" value="transfer"><span>Chuyển khoản<small>Hiện số tài khoản mẫu</small></span></label>' +
          "</fieldset>" +
          '<div id="bank-preview" class="notice" hidden><strong>Tài khoản mẫu</strong><p>' + esc(bank.note || "") + "</p>" +
            "<p>" + esc(bank.bankName || "") + " · " + esc(bank.accountNumber || "") + " · " + esc(bank.accountName || "") + "</p></div>" +
          '<p class="field-error" data-error="form"></p>' +
          '<button class="btn btn-primary btn-block" type="submit">Đặt món</button>' +
        "</div>" +
        '<div id="checkout-summary"></div>' +
      "</form>";
    const form = $("#checkout-form");
    form.addEventListener("input", refreshCheckoutSummary);
    form.addEventListener("change", refreshCheckoutSummary);
    form.addEventListener("submit", submitOrder);
    refreshCheckoutSummary();
  }

  function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const cart = loadCart();
    const name = form.elements.name.value.trim();
    const phone = normalizePhone(form.elements.phone.value);
    const method = selectedValue(form, "fulfillment", "delivery");
    const address = form.elements.address.value.trim();
    const note = form.elements.note.value.trim().slice(0, 240);
    const payment = selectedValue(form, "payment", "cash");
    let valid = true;
    setFieldError(form, "name", "");
    setFieldError(form, "phone", "");
    setFieldError(form, "address", "");
    setFieldError(form, "form", "");
    if (name.length < 2) {
      setFieldError(form, "name", "Nhập họ tên.");
      valid = false;
    }
    if (!phone) {
      setFieldError(form, "phone", "Số điện thoại chưa đúng. Ví dụ 0901234567.");
      valid = false;
    }
    if (method === "delivery" && address.length < 5) {
      setFieldError(form, "address", "Nhập địa chỉ giao hàng.");
      valid = false;
    }
    if (!cart.length) {
      setFieldError(form, "form", "Giỏ đang trống.");
      valid = false;
    }
    if (!valid) return;
    const button = form.querySelector("[type=submit]");
    if (button.disabled) return;
    button.disabled = true;
    const previousLabel = button.textContent;
    button.textContent = "Đang gửi đơn…";
    const payload = {
      customerName: name,
      phone: phone,
      fulfillment: method,
      address: method === "delivery" ? address : "",
      payment: payment,
      note: note,
      lines: cart.map(function (line) {
        return {
          id: line.itemId,
          size: line.size,
          sugar: line.sugarLabel || "",
          ice: line.iceLabel || "",
          toppings: line.toppingLabels || [],
          qty: line.quantity,
          note: line.note || ""
        };
      })
    };
    const sender = window.App && App.postOrder ? App.postOrder(payload) : Promise.reject(new Error("Không gửi được đơn."));
    sender.then(function (order) {
      const orders = loadOrders();
      orders[order.id] = order;
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      localStorage.setItem(CART_KEY, "[]");
      updateBadges([]);
      location.href = "order.html?id=" + encodeURIComponent(order.id);
    }).catch(function (error) {
      button.disabled = false;
      button.textContent = previousLabel;
      setFieldError(form, "form", (error && error.message) || "Không gửi được đơn. Giỏ vẫn còn.");
    });
  }

  function copyText(text, button) {
    function done() {
      const previous = button.textContent;
      button.textContent = "Đã chép";
      setTimeout(function () { button.textContent = previous; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        window.prompt("Sao chép nội dung này:", text);
      });
      return;
    }
    window.prompt("Sao chép nội dung này:", text);
  }

  function renderOrder() {
    const root = $("#order-app");
    if (!root) return;
    const params = new URLSearchParams(location.search);
    const order = loadOrders()[params.get("id") || ""];
    if (!order) {
      root.innerHTML =
        '<div class="empty"><h2>Không thấy đơn</h2><p>Mã này không có trong trình duyệt hiện tại.</p>' +
        '<p class="stack-actions" style="justify-content:center"><a class="btn btn-primary" href="menu.html">Về thực đơn</a></p></div>';
      return;
    }
    const when = new Date(order.createdAt);
    const time = Number.isNaN(when.getTime())
      ? ""
      : when.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
    const lines = (order.lines || []).map(function (line) {
      return "<div><span>" + esc(line.quantity) + " × " + esc(line.name) +
        '<br><small class="muted">' + esc(optionSummary(line)) + "</small></span><strong>" +
        formatVnd(lineTotal(line)) + "</strong></div>";
    }).join("");
    const bank = shop().bank || {};
    const transferNote = order.id + " " + (order.customer.phone || "");
    const bankBlock = order.payment === "transfer"
      ? '<div class="notice" style="margin-top:14px"><strong>Chuyển khoản</strong><p>' + esc(bank.note || "") + "</p>" +
        '<div class="bank-row"><span>Ngân hàng</span><strong>' + esc(bank.bankName || "") + "</strong></div>" +
        '<div class="bank-row"><span>Số tài khoản</span><strong>' + esc(bank.accountNumber || "") + "</strong></div>" +
        '<div class="bank-row"><span>Chủ tài khoản</span><strong>' + esc(bank.accountName || "") + "</strong></div>" +
        '<div class="bank-row"><span>Chi nhánh</span><strong>' + esc(bank.branch || "") + "</strong></div>" +
        '<div class="bank-row"><span>Nội dung</span><strong>' + esc(transferNote) + "</strong></div>" +
        '<p class="stack-actions"><button type="button" class="btn btn-ghost" data-copy="' + esc(bank.accountNumber || "") + '">Chép số tài khoản</button>' +
        '<button type="button" class="btn btn-ghost" data-copy="' + esc(transferNote) + '">Chép nội dung</button></p></div>'
      : "";
    root.innerHTML =
      '<article class="ticket">' +
        '<p class="eyebrow">' + (order.sent ? "Đã gửi cho quán" : "Đơn lưu trên máy này") + "</p>" +
        '<h2 class="order-code">' + esc(order.id) + "</h2>" +
        '<p class="muted">' + esc(time) + " · " + esc(shop().name || "") + "</p>" +
        "<p>" + (order.sent
          ? "Đơn đã gửi cho quán và được ghi vào Google Sheet. Giữ mã này khi nhận món."
          : "Đưa mã này cho quán khi nhận món. Đơn này chưa được gửi lên Google Sheet.") + "</p>" +
        "<p><strong>" + esc(order.customer.name) + "</strong> · " + esc(order.customer.phone) + "<br>" +
          esc(FULFILLMENT[order.fulfillment] || order.fulfillment) +
          (order.address ? " · " + esc(order.address) : "") + "<br>" +
          esc(PAYMENT[order.payment] || order.payment) +
          (order.note ? "<br>Ghi chú: " + esc(order.note) : "") +
        "</p>" +
        '<div class="totals">' + lines +
          "<div><span>Tạm tính</span><strong>" + formatVnd(order.subtotal) + "</strong></div>" +
          "<div><span>Phí giao hàng</span><strong>" + formatVnd(order.deliveryFee) + "</strong></div>" +
          '<div class="grand"><span>Tổng</span><strong>' + formatVnd(order.total) + "</strong></div>" +
        "</div>" +
        bankBlock +
        '<p class="stack-actions"><a class="btn btn-primary" href="menu.html">Đặt thêm</a>' +
        '<a class="btn btn-ghost" data-bind-phone href="">Gọi quán</a></p>' +
      "</article>";
    bindShop();
    $all("[data-copy]", root).forEach(function (button) {
      button.addEventListener("click", function () {
        copyText(button.getAttribute("data-copy"), button);
      });
    });
  }

  function init() {
    bindShop();
    updateBadges();
    const page = document.body.dataset.page;
    if (page === "home") renderHome();
    if (page === "menu") renderMenu();
    if (page === "cart") renderCart();
    if (page === "checkout") renderCheckout();
    if (page === "order") renderOrder();

    document.body.addEventListener("click", function (event) {
      const opener = event.target.closest("[data-open-item]");
      if (opener) {
        event.preventDefault();
        openModal(opener.getAttribute("data-open-item"));
        return;
      }
      const cartBtn = event.target.closest("[data-cart-action]");
      if (cartBtn) {
        event.preventDefault();
        updateCartLine(cartBtn.getAttribute("data-cart-action"), cartBtn.getAttribute("data-line-id"));
      }
    });
  }

  function boot() {
    const ready = window.App && App.loadCatalog ? App.loadCatalog() : Promise.resolve();
    ready.then(init, init);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
    trapModalTab(event);
  });
})();
