(function () {
  "use strict";

  const CART_KEY = "abeos-house:cart";
  const ORDERS_KEY = "abeos-house:orders";
  const HISTORY_KEY = "abeos.orders.v1";
  const PENDING_ORDER_KEY = "abeos-house:pending-order-id";
  const FLASH_KEY = "abeos-house:flash";
  const HISTORY_LIMIT = 50;

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

  function loadHistory() {
    const parsed = loadJson(HISTORY_KEY, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function (order) { return order && order.id; });
  }

  function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
    updateBadges();
  }

  function updateBadges(cart) {
    const count = cartCount(cart || loadCart());
    $all("[data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
      el.classList.toggle("is-zero", count === 0);
    });
    const orders = loadHistory().length;
    $all("[data-order-count]").forEach(function (el) {
      el.textContent = String(orders);
      el.classList.toggle("is-zero", orders === 0);
    });
  }

  function vietnamClock(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);
      function part(type) {
        const found = parts.find(function (item) { return item.type === type; });
        return found ? found.value : "";
      }
      return part("day") + "/" + part("month") + "/" + part("year") + " " + part("hour") + ":" + part("minute") + ":" + part("second");
    } catch (error) {
      return "";
    }
  }

  function displayTime(order) {
    const placed = order && order.placedAt ? String(order.placedAt) : "";
    if (placed && !/^\d{4}-\d{2}-\d{2}T/.test(placed)) return placed;
    return vietnamClock(order && order.createdAt) || placed;
  }

  function snapshotLine(line, unitPriceOverride) {
    const quantity = Math.max(1, Math.min(20, Number(line.quantity || line.qty) || 1));
    const price = unitPriceOverride != null ? Number(unitPriceOverride) : Number(line.unitPrice) || 0;
    return {
      itemId: line.itemId || line.id || "",
      name: line.name || "",
      image: line.image || "",
      size: line.size || "",
      sizeLabel: line.sizeLabel || "",
      sugar: line.sugar || "",
      sugarLabel: line.sugarLabel || "",
      ice: line.ice || "",
      iceLabel: line.iceLabel || "",
      toppingIds: (line.toppingIds || []).slice(),
      toppingLabels: (line.toppingLabels || []).slice(),
      note: line.note || "",
      quantity: quantity,
      unitPrice: Number.isFinite(price) ? price : 0
    };
  }

  function snapshotLines(cart, order) {
    const source = cart && cart.length ? cart : ((order && order.lines) || []);
    const priced = order && Array.isArray(order.lines) ? order.lines : [];
    const sameShape = source.length && priced.length === source.length && priced.every(function (line) {
      return line && line.itemId && line.unitPrice != null;
    });
    return source.map(function (line, index) {
      const override = sameShape ? priced[index].unitPrice : null;
      return snapshotLine(line, override);
    });
  }

  function rememberOrder(order, cart) {
    if (!order || !order.id) return;
    const record = {
      id: String(order.id),
      createdAt: order.createdAt || new Date().toISOString(),
      placedAt: displayTime(order) || vietnamClock(new Date()),
      customer: {
        name: (order.customer && order.customer.name) || "",
        phone: (order.customer && order.customer.phone) || ""
      },
      address: order.address || "",
      fulfillment: order.fulfillment || "",
      payment: order.payment || "",
      note: order.note || "",
      lines: snapshotLines(cart, order),
      subtotal: Number(order.subtotal) || 0,
      deliveryFee: Number(order.deliveryFee) || 0,
      total: Number(order.total) || 0
    };
    const rest = loadHistory().filter(function (item) { return item.id !== record.id; });
    saveHistory([record].concat(rest));
  }

  function historySummary(record) {
    const parts = (record.lines || []).map(function (line) {
      return (line.quantity || 1) + " × " + (line.name || "Món");
    });
    if (!parts.length) return "Không có món";
    if (parts.length <= 3) return parts.join(", ");
    return parts.slice(0, 2).join(", ") + " và " + (parts.length - 2) + " món nữa";
  }

  function setFlash(message) {
    try { sessionStorage.setItem(FLASH_KEY, message); } catch (error) { /* bộ nhớ riêng tư */ }
  }

  function consumeFlash() {
    try {
      const message = sessionStorage.getItem(FLASH_KEY) || "";
      if (message) sessionStorage.removeItem(FLASH_KEY);
      return message;
    } catch (error) {
      return "";
    }
  }

  function choiceByIdOrLabel(list, id, label) {
    return (list || []).find(function (choice) {
      return (id && (choice.id === id || choice.label === id)) ||
        (label && (choice.id === label || choice.label === label || choice.name === label));
    }) || null;
  }

  function readdOrder(record) {
    const cart = loadCart();
    let added = 0;
    let skipped = 0;
    (record.lines || []).forEach(function (saved) {
      const item = findItem(saved.itemId);
      if (!item) {
        skipped += 1;
        return;
      }
      const options = itemOptions(item);
      const size = choiceByIdOrLabel(options.sizes, saved.size, saved.sizeLabel) || (options.sizes || [])[0] || null;
      const sugar = choiceByIdOrLabel(options.sugar, saved.sugar, saved.sugarLabel);
      const ice = choiceByIdOrLabel(options.ice, saved.ice, saved.iceLabel);
      const toppingIds = [];
      const toppingLabels = [];
      (options.toppings || []).forEach(function (topping) {
        const wanted = (saved.toppingIds || []).concat(saved.toppingLabels || []);
        const name = topping.label || topping.name;
        if (wanted.indexOf(topping.id) !== -1 || wanted.indexOf(name) !== -1) {
          toppingIds.push(topping.id);
          toppingLabels.push(name);
        }
      });
      const line = {
        lineId: uid(),
        itemId: item.id,
        name: item.name,
        image: item.image || "",
        size: size ? size.id : "",
        sizeLabel: size ? size.label : "",
        sugar: sugar ? sugar.id : "",
        sugarLabel: sugar ? sugar.label : "",
        ice: ice ? ice.id : "",
        iceLabel: ice ? ice.label : "",
        toppingIds: toppingIds,
        toppingLabels: toppingLabels,
        note: String(saved.note || "").slice(0, 140),
        quantity: Math.max(1, Math.min(20, Number(saved.quantity) || 1)),
        unitPrice: unitPrice(item, size ? size.id : "", toppingIds)
      };
      const sig = signature(line);
      const existing = cart.find(function (row) { return signature(row) === sig; });
      if (existing) existing.quantity = Math.min(20, existing.quantity + line.quantity);
      else cart.push(line);
      added += 1;
    });
    if (added) saveCart(cart);
    return { added: added, skipped: skipped };
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
    $all(".brand-mark").forEach(function (mark) {
      if (info.logo) {
        mark.removeAttribute("aria-hidden");
        mark.textContent = "";
        var img = document.createElement("img");
        img.className = "brand-logo";
        img.src = info.logo;
        img.alt = info.name || "A Béo's House";
        mark.appendChild(img);
      } else {
        mark.textContent = "AB";
        mark.setAttribute("aria-hidden", "true");
      }
    });
    var icon = document.querySelector('link[rel="icon"]');
    if (icon && info.logo) icon.href = info.logo;
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

  function catalogBlocked() {
    return window.App && App.catalog && App.catalog.failed;
  }

  function retryCatalog() {
    try { sessionStorage.setItem("abeos-house:catalog-force", "1"); } catch (error) { /* bộ nhớ riêng tư */ }
    location.reload();
  }

  function renderHome() {
    const featured = $("#featured");
    if (!featured) return;
    if (catalogBlocked()) {
      featured.innerHTML =
        '<div class="empty" role="status"><h2>Chưa tải được thực đơn</h2><p>Anh/chị thử lại nhé.</p>' +
        '<p class="stack-actions" style="justify-content:center"><button type="button" class="btn btn-primary" data-catalog-retry>Thử lại</button></p></div>';
      return;
    }
    const items = menu().filter(function (item) { return item.popular; });
    featured.innerHTML = items.length
      ? items.map(cardHtml).join("")
      : '<div class="empty" role="status"><h2>Chưa có món nổi bật</h2><p>Mở thực đơn để xem món đang bán.</p></div>';
  }

  function renderMenu() {
    const root = $("#menu-app");
    if (!root) return;
    if (catalogBlocked()) {
      root.innerHTML =
        '<div class="empty" role="status"><h2>Chưa tải được thực đơn</h2>' +
        '<p>Anh/chị thử lại nhé.</p>' +
        '<p class="stack-actions" style="justify-content:center"><button type="button" class="btn btn-primary" data-catalog-retry>Thử lại</button></p></div>';
      return;
    }
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
    if (lead) lead.textContent = cartCount(cart) + " món.";
    const flash = consumeFlash();
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
      (flash ? '<p class="notice" role="status">' + esc(flash) + "</p>" : "") +
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
    root.innerHTML =
      '<form id="checkout-form" class="checkout-layout" novalidate>' +
        "<div>" +
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
          '<div id="bank-preview" class="notice" hidden><strong>' + (bank.placeholder ? "Tài khoản mẫu" : "Chuyển khoản") + '</strong><p>' + esc(bank.note || "") + "</p>" +
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

  function pendingOrderId() {
    try {
      const existing = sessionStorage.getItem(PENDING_ORDER_KEY);
      if (existing && /^AB-[A-Z0-9]{4}$/.test(existing)) return existing;
    } catch (error) { /* bộ nhớ riêng tư */ }
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "AB-";
    for (let i = 0; i < 4; i += 1) id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    try { sessionStorage.setItem(PENDING_ORDER_KEY, id); } catch (error) { /* bỏ qua */ }
    return id;
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
    const orderId = pendingOrderId();
    const button = form.querySelector("[type=submit]");
    if (button.disabled) return;
    button.disabled = true;
    const previousLabel = button.textContent;
    button.textContent = "Đang gửi đơn…";
    const payload = {
      id: orderId,
      customerName: name,
      phone: phone,
      fulfillment: method,
      address: method === "delivery" ? address : "",
      payment: payment,
      note: note,
      lines: cart.map(function (line) {
        return {
          id: line.itemId,
          size: line.sizeLabel || line.size,
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
      try { rememberOrder(order, cart); } catch (error) { /* lịch sử đầy hoặc bị chặn */ }
      const orders = loadOrders();
      orders[order.id] = order;
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      localStorage.setItem(CART_KEY, "[]");
      try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch (error) { /* bỏ qua */ }
      updateBadges([]);
      location.href = "order.html?id=" + encodeURIComponent(order.id);
    }).catch(function (error) {
      button.disabled = false;
      button.textContent = previousLabel;
      const fields = (error && error.fields) || {};
      if (fields.customerName) setFieldError(form, "name", fields.customerName);
      if (fields.phone) setFieldError(form, "phone", fields.phone);
      if (fields.address) setFieldError(form, "address", fields.address);
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

  const ORDER_STATUS = {
    NEW: "Mới",
    ACCEPTED: "Đã nhận",
    DONE: "Hoàn tất",
    CANCELLED: "Đã hủy"
  };

  function lookupMarkup(code) {
    return (
      '<form id="order-lookup" class="card" novalidate>' +
        "<h2>Tra cứu đơn</h2>" +
        '<p class="muted">Mã dạng AB-XXXX. Có số điện thoại lúc đặt thì xem được chi tiết. Không nhập số thì chỉ thấy trạng thái và tổng tiền.</p>' +
        '<label class="field">Mã đơn<input name="code" maxlength="12" autocomplete="off" autocapitalize="characters" value="' + esc(code || "") + '"></label>' +
        '<p class="field-error" data-error="code"></p>' +
        '<label class="field">Số điện thoại<input name="phone" inputmode="tel" autocomplete="tel" maxlength="16"></label>' +
        '<p class="field-error" data-error="phone"></p>' +
        '<p class="field-error" data-error="form"></p>' +
        '<button class="btn btn-primary" type="submit">Xem đơn</button>' +
      "</form>" +
      '<div id="lookup-result"></div>'
    );
  }

  function renderLookupSummary(order) {
    const slot = $("#lookup-result");
    if (!slot) return;
    slot.innerHTML =
      '<article class="ticket">' +
        '<p class="eyebrow">Tóm tắt đơn</p>' +
        '<h2 class="order-code">' + esc(order.id) + "</h2>" +
        "<p>" + esc(ORDER_STATUS[order.status] || order.status || "Đã ghi nhận") + "</p>" +
        "<p>" + esc(order.itemCount) + " món · Tổng <strong>" + formatVnd(order.total) + "</strong></p>" +
        '<p class="muted">Nhập số điện thoại lúc đặt để xem tên, món và địa chỉ.</p>' +
      "</article>";
  }

  function storeLookedUpOrder(order) {
    const orders = loadOrders();
    orders[order.id] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    try { rememberOrder(order); } catch (error) { /* lịch sử đầy hoặc bị chặn */ }
    updateBadges();
  }

  function submitLookup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = form.elements.code.value.trim().toUpperCase();
    const phoneRaw = form.elements.phone.value.trim();
    setFieldError(form, "code", "");
    setFieldError(form, "phone", "");
    setFieldError(form, "form", "");
    const result = $("#lookup-result");
    if (result) result.innerHTML = "";
    if (!/^AB-[A-Z0-9]{4}$/.test(code)) {
      setFieldError(form, "code", "Mã đơn phải dạng AB-XXXX.");
      return;
    }
    let phone = "";
    if (phoneRaw) {
      phone = normalizePhone(phoneRaw);
      if (!phone) {
        setFieldError(form, "phone", "Số điện thoại chưa đúng. Ví dụ 0901234567.");
        return;
      }
    }
    const button = form.querySelector("[type=submit]");
    if (!button || button.disabled) return;
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "Đang tìm đơn…";
    const finder = window.App && App.lookupOrder
      ? App.lookupOrder(code, phone)
      : Promise.reject(new Error("Không tra cứu được đơn."));
    finder.then(function (order) {
      button.disabled = false;
      button.textContent = previous;
      if (order.summary) {
        renderLookupSummary(order);
        return;
      }
      storeLookedUpOrder(order);
      if (document.body.dataset.page === "order") {
        const url = new URL(location.href);
        url.searchParams.set("id", order.id);
        history.replaceState(null, "", url.pathname + url.search);
        renderOrder();
        return;
      }
      location.href = "orders.html?id=" + encodeURIComponent(order.id);
    }).catch(function (error) {
      button.disabled = false;
      button.textContent = previous;
      const fields = (error && error.fields) || {};
      if (fields.code) setFieldError(form, "code", fields.code);
      if (fields.phone) setFieldError(form, "phone", fields.phone);
      setFieldError(form, "form", (error && error.message) || "Không tìm được đơn.");
    });
  }

  function bindLookup(root) {
    const form = $("#order-lookup", root);
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", submitLookup);
  }

  function renderOrder() {
    const root = $("#order-app");
    if (!root) return;
    const params = new URLSearchParams(location.search);
    const order = loadOrders()[params.get("id") || ""];
    if (!order) {
      root.innerHTML =
        '<div class="empty"><h2>Không thấy đơn</h2><p>Nhập mã và số điện thoại lúc đặt để xem đơn.</p></div>' +
        lookupMarkup(params.get("id") || "");
      bindLookup(root);
      return;
    }
    const when = new Date(order.createdAt);
    const time = Number.isNaN(when.getTime())
      ? String(order.placedAt || order.createdAt || "")
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
        '<p class="eyebrow">' + (order.sent ? "Đã gửi cho quán" : "Chưa gửi cho quán") + "</p>" +
        '<h2 class="order-code">' + esc(order.id) + "</h2>" +
        '<p class="muted">' + esc(time) + " · " + esc(shop().name || "") + "</p>" +
        "<p>" + (order.sent
          ? "Đơn đã gửi cho quán. Giữ mã này khi nhận món."
          : "Đưa mã này cho quán khi nhận món. Đơn này chưa được gửi tới quán.") + "</p>" +
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
        '<a class="btn btn-ghost" href="orders.html?id=' + encodeURIComponent(order.id) + '">Đơn của tôi</a>' +
        '<a class="btn btn-ghost" data-bind-phone href="">Gọi quán</a></p>' +
      "</article>";
    bindShop();
    $all("[data-copy]", root).forEach(function (button) {
      button.addEventListener("click", function () {
        copyText(button.getAttribute("data-copy"), button);
      });
    });
  }

  function renderHistory() {
    const root = $("#orders-app");
    if (!root) return;
    const params = new URLSearchParams(location.search);
    const selected = params.get("id");
    const list = loadHistory();
    if (selected) {
      renderHistoryDetail(root, list.find(function (order) { return order.id === selected; }) || null);
      return;
    }
    const lead = $("#orders-lead");
    if (lead) {
      lead.textContent = list.length
        ? "Các đơn gần đây của bạn."
        : "Chưa có đơn nào.";
    }
    if (!list.length) {
      root.innerHTML =
        lookupMarkup("") +
        '<div class="empty"><h2>Chưa có đơn</h2><p>Đơn đã gửi thành công sẽ hiện ở đây, mới nhất trước.</p>' +
        '<p class="stack-actions" style="justify-content:center"><a class="btn btn-primary" href="menu.html">Mở thực đơn</a></p></div>';
      bindLookup(root);
      return;
    }
    const cards = list.map(function (order) {
      return (
        '<article class="history-card">' +
          '<a class="history-open" href="orders.html?id=' + encodeURIComponent(order.id) + '">' +
            '<div class="history-meta"><strong>' + esc(order.id) + '</strong><span class="price">' + formatVnd(order.total) + "</span></div>" +
            '<p class="muted">' + esc(order.placedAt || "") + "</p>" +
            "<p>" + esc(historySummary(order)) + "</p>" +
          "</a>" +
          '<button type="button" class="text-btn" data-history-delete="' + esc(order.id) + '">Xóa</button>' +
        "</article>"
      );
    }).join("");
    root.innerHTML =
      lookupMarkup("") +
      cards +
      '<div class="card" id="wipe-box">' +
        '<p class="stack-actions"><button type="button" class="btn btn-ghost" data-history-wipe-ask>Xóa tất cả</button></p>' +
        '<div id="wipe-confirm" hidden>' +
          "<p>Xóa hết các đơn trên trang này? Không lấy lại được.</p>" +
          '<p class="stack-actions"><button type="button" class="btn btn-primary" data-history-wipe-yes>Xóa hết</button>' +
          '<button type="button" class="btn btn-ghost" data-history-wipe-no>Giữ lại</button></p>' +
        "</div>" +
      "</div>";
    bindLookup(root);
  }

  function renderHistoryDetail(root, order) {
    const lead = $("#orders-lead");
    if (!order) {
      if (lead) lead.textContent = "Không thấy đơn này.";
      root.innerHTML =
        '<div class="empty"><h2>Không thấy đơn</h2><p>Không thấy đơn này. Tra cứu bằng số điện thoại lúc đặt.</p></div>' +
        lookupMarkup(new URLSearchParams(location.search).get("id") || "") +
        '<p class="stack-actions"><a class="btn btn-ghost" href="orders.html">Về đơn của tôi</a></p>';
      bindLookup(root);
      return;
    }
    if (lead) lead.textContent = "Chi tiết đơn.";
    const customer = order.customer || {};
    const phone = prettyPhone(String(customer.phone || "").replace(/\D/g, "")) || customer.phone || "";
    const lines = (order.lines || []).map(function (line) {
      return (
        '<div><span>' + esc(line.quantity) + " × " + esc(line.name) +
          '<br><small class="muted">' + esc(optionSummary(line)) + "</small></span><strong>" +
          formatVnd(lineTotal(line)) + "</strong></div>"
      );
    }).join("");
    root.innerHTML =
      '<p><a href="orders.html">Tất cả đơn</a></p>' +
      '<article class="ticket">' +
        '<p class="eyebrow">Đã gửi cho quán</p>' +
        '<h2 class="order-code">' + esc(order.id) + "</h2>" +
        '<p class="muted">' + esc(order.placedAt || "") + "</p>" +
        "<p><strong>" + esc(customer.name || "") + "</strong>" + (phone ? " · " + esc(phone) : "") + "<br>" +
          esc(FULFILLMENT[order.fulfillment] || order.fulfillment || "") +
          (order.address ? " · " + esc(order.address) : "") + "<br>" +
          esc(PAYMENT[order.payment] || order.payment || "") +
          (order.note ? "<br>Ghi chú: " + esc(order.note) : "") +
        "</p>" +
        '<div class="totals">' + lines +
          "<div><span>Tạm tính</span><strong>" + formatVnd(order.subtotal) + "</strong></div>" +
          "<div><span>Phí giao hàng</span><strong>" + formatVnd(order.deliveryFee) + "</strong></div>" +
          '<div class="grand"><span>Tổng</span><strong>' + formatVnd(order.total) + "</strong></div>" +
        "</div>" +
        '<p class="stack-actions">' +
          '<button type="button" class="btn btn-primary" data-history-reorder="' + esc(order.id) + '">Đặt lại</button>' +
          '<button type="button" class="btn btn-ghost" data-history-delete="' + esc(order.id) + '">Xóa đơn</button>' +
        "</p>" +
        '<p class="field-error" data-history-note></p>' +
      "</article>";
  }

  function deleteHistory(id) {
    saveHistory(loadHistory().filter(function (order) { return order.id !== id; }));
    const params = new URLSearchParams(location.search);
    if (params.get("id") === id) {
      location.href = "orders.html";
      return;
    }
    renderHistory();
  }

  function reorderHistory(id) {
    const record = loadHistory().find(function (order) { return order.id === id; });
    if (!record) return;
    const result = readdOrder(record);
    const note = document.querySelector("[data-history-note]");
    if (!result.added) {
      if (note) note.textContent = "Các món này không còn bán.";
      return;
    }
    const skipped = result.skipped
      ? " Bỏ qua " + result.skipped + " món không còn bán."
      : "";
    setFlash("Đã thêm " + result.added + " món vào giỏ." + skipped);
    location.href = "cart.html";
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
    if (page === "orders") renderHistory();

    document.body.addEventListener("click", function (event) {
      if (event.target.closest("[data-catalog-retry]")) {
        event.preventDefault();
        retryCatalog();
        return;
      }
      const wipeAsk = event.target.closest("[data-history-wipe-ask]");
      if (wipeAsk) {
        const box = $("#wipe-confirm");
        if (box) box.hidden = false;
        wipeAsk.hidden = true;
        return;
      }
      if (event.target.closest("[data-history-wipe-no]")) {
        const box = $("#wipe-confirm");
        const ask = document.querySelector("[data-history-wipe-ask]");
        if (box) box.hidden = true;
        if (ask) ask.hidden = false;
        return;
      }
      if (event.target.closest("[data-history-wipe-yes]")) {
        saveHistory([]);
        renderHistory();
        return;
      }
      const reorder = event.target.closest("[data-history-reorder]");
      if (reorder) {
        reorderHistory(reorder.getAttribute("data-history-reorder"));
        return;
      }
      const removeOrder = event.target.closest("[data-history-delete]");
      if (removeOrder) {
        event.preventDefault();
        deleteHistory(removeOrder.getAttribute("data-history-delete"));
        return;
      }
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
