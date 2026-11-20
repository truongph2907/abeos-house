/* Đọc CSV Google Sheet, link ảnh Drive, và ô "lựa chọn". Dùng chung cho trang và kiểm thử. */
(function (root) {
  var App = root.App || (root.App = {});

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

  function parseCsv(text) {
    var src = String(text || "").replace(/^\uFEFF/, "");
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < src.length; i += 1) {
      var c = src[i];
      if (inQuotes) {
        if (c === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i += 1;
          } else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c !== "\r") field += c;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter(function (cells) {
      return cells.some(function (cell) { return String(cell).trim() !== ""; });
    });
  }

  function asText(value) {
    if (value == null) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") {
      if (!isFinite(value)) return "";
      return String(value);
    }
    return String(value);
  }

  function parseMoney(value) {
    var raw = asText(value).trim().replace(/\s/g, "").replace(/đ/gi, "");
    if (!raw) return 0;
    var neg = raw.charAt(0) === "-";
    if (raw.charAt(0) === "+" || raw.charAt(0) === "-") raw = raw.slice(1);
    raw = raw.replace(/\./g, "").replace(/,/g, "");
    if (!/^\d+$/.test(raw)) return 0;
    var n = Number(raw);
    return neg ? -n : n;
  }

  function driveImageUrl(value) {
    var raw = asText(value).trim();
    if (!raw) return "";
    if (/^(img\/|\.\/|\.\.\/)/.test(raw)) return raw;
    var id = "";
    var file = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    var query = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (file) id = file[1];
    else if (query && /drive\.google\.com/i.test(raw)) id = query[1];
    if (id) return "https://lh3.googleusercontent.com/d/" + id;
    return raw;
  }

  function normalizeSpreadsheetId(value) {
    var raw = String(value || "").trim();
    var match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : raw;
  }

  function compactKey(value) {
    return fold(value).replace(/[\s_]+/g, "");
  }

  function shopField(key) {
    var map = {
      name: "name",
      ten: "name",
      tenquan: "name",
      tagline: "tagline",
      khauhieu: "tagline",
      heroimage: "heroImage",
      anhbia: "heroImage",
      anhdau: "heroImage",
      logo: "logo",
      logourl: "logo",
      anhlogo: "logo",
      herocaption: "heroCaption",
      chuthichanh: "heroCaption",
      address: "address",
      diachi: "address",
      phone: "phone",
      dienthoai: "phone",
      sodienthoai: "phone",
      phonetel: "phoneTel",
      hours: "hours",
      giomocua: "hours",
      gio: "hours",
      deliveryfee: "deliveryFee",
      phigiao: "deliveryFee",
      phigiaohang: "deliveryFee",
      bankname: "bankName",
      nganhang: "bankName",
      accountnumber: "accountNumber",
      sotaikhoan: "accountNumber",
      accountname: "accountName",
      chutaikhoan: "accountName",
      branch: "branch",
      chinhanh: "branch",
      banknote: "bankNote",
      ghichunganhang: "bankNote",
      bankplaceholder: "bankPlaceholder",
      notifyemail: "notifyEmail",
      email: "notifyEmail",
      emailnhandon: "notifyEmail"
    };
    return map[compactKey(key)] || "";
  }

  function isYes(value, whenBlank) {
    if (typeof value === "boolean") return value;
    var v = compactKey(value);
    if (!v) return !!whenBlank;
    if (v === "0" || v === "khong" || v === "an" || v === "hidden" || v === "no" || v === "false" || v === "off") return false;
    if (v === "1" || v === "co" || v === "yes" || v === "true" || v === "on" || v === "dangban") return true;
    return !!whenBlank;
  }

  function categoryOf(value) {
    var v = fold(value);
    if (!v || v === "drink" || v === "do uong") return { id: "drink", label: "Đồ uống" };
    if (v === "food" || v === "do an") return { id: "food", label: "Đồ ăn" };
    var label = String(value || "").trim();
    return { id: "cat-" + fold(label).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), label: label };
  }

  function optionKind(key) {
    var k = compactKey(key);
    if (k === "size" || k === "co" || k === "khau" || k === "khauphan") return "size";
    if (k === "sugar" || k === "duong") return "sugar";
    if (k === "ice" || k === "da") return "ice";
    if (k === "topping" || k === "toppings" || k === "them") return "topping";
    return "";
  }

  function parseChoice(text) {
    var raw = String(text || "").trim();
    if (!raw) return null;
    var match = raw.match(/^(.*\S)\s+([+-]?\d[\d.]*)$/);
    var label = raw;
    var amount = 0;
    if (match) {
      label = match[1].trim();
      amount = parseMoney(match[2]);
    }
    if (!label) return null;
    return { id: label, label: label, extra: amount, price: amount };
  }

  function parseOptions(text) {
    var options = { sizes: [], sugar: [], ice: [], toppings: [] };
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === "#") return;
      var splitAt = trimmed.indexOf(":");
      if (splitAt === -1) return;
      var kind = optionKind(trimmed.slice(0, splitAt));
      if (!kind) return;
      trimmed.slice(splitAt + 1).split("|").forEach(function (part) {
        var choice = parseChoice(part);
        if (!choice) return;
        if (kind === "size") options.sizes.push(choice);
        else if (kind === "sugar") options.sugar.push(choice);
        else if (kind === "ice") options.ice.push(choice);
        else options.toppings.push(choice);
      });
    });
    return options;
  }

  function headerMap(headers) {
    var alias = {
      ma: "id",
      id: "id",
      ten: "name",
      name: "name",
      mota: "description",
      description: "description",
      nhom: "category",
      category: "category",
      anh: "image",
      image: "image",
      gia: "price",
      price: "price",
      luachon: "options",
      options: "options",
      dangban: "available",
      available: "available",
      thutu: "sort",
      sort: "sort",
      noibat: "popular",
      popular: "popular",
      goiyghichu: "noteHint",
      notehint: "noteHint"
    };
    var map = {};
    headers.forEach(function (header, index) {
      var field = alias[compactKey(header)];
      if (field) map[field] = index;
    });
    return map;
  }

  function cell(row, map, field) {
    if (map[field] == null) return "";
    return asText(row[map[field]]).trim();
  }

  function phoneTelFrom(phone) {
    var digits = String(phone || "").replace(/[^\d+]/g, "");
    if (/^0\d{9}$/.test(digits)) return "+84" + digits.slice(1);
    return digits;
  }

  function shopFromRows(rows) {
    var start = 0;
    if (rows.length && /^(key|khoa|truong)$/.test(compactKey(rows[0][0]))) start = 1;
    var bag = {};
    for (var i = start; i < rows.length; i += 1) {
      var field = shopField(rows[i][0]);
      if (!field) continue;
      bag[field] = asText(rows[i][1]).trim();
    }
    var phone = bag.phone || "";
    return {
      name: bag.name || "",
      tagline: bag.tagline || "",
      heroImage: driveImageUrl(bag.heroImage || ""),
      heroCaption: bag.heroCaption || "",
      logo: driveImageUrl(bag.logo || ""),
      address: bag.address || "",
      phone: phone,
      phoneTel: bag.phoneTel || phoneTelFrom(phone),
      hours: bag.hours || "",
      deliveryFee: parseMoney(bag.deliveryFee),
      bank: {
        bankName: bag.bankName || "",
        accountNumber: bag.accountNumber || "",
        accountName: bag.accountName || "",
        branch: bag.branch || "",
        placeholder: isYes(bag.bankPlaceholder, false),
        note: bag.bankNote || ""
      }
    };
  }

  function shopFromCsv(text) {
    return shopFromRows(parseCsv(text));
  }

  function mergeShop(base, sheetShop) {
    var shop = Object.assign({}, base, sheetShop || {});
    shop.bank = Object.assign({}, (base && base.bank) || {}, (sheetShop && sheetShop.bank) || {});
    if (!sheetShop || !sheetShop.heroImage) shop.heroImage = base.heroImage || "";
    if (!sheetShop || !sheetShop.heroCaption) shop.heroCaption = base.heroCaption || "";
    if (!sheetShop || !sheetShop.logo) shop.logo = (base && base.logo) || "";
    if (!sheetShop || !sheetShop.tagline) shop.tagline = base.tagline || "";
    return shop;
  }

  function slugId(name, used) {
    var base = fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mon";
    var id = base;
    var n = 2;
    while (used[id]) {
      id = base + "-" + n;
      n += 1;
    }
    used[id] = true;
    return id;
  }

  function productsFromRows(rows) {
    if (!rows.length) return [];
    var map = headerMap(rows[0]);
    if (map.name == null && map.price == null) return [];
    var used = {};
    var items = [];
    for (var i = 1; i < rows.length; i += 1) {
      var row = rows[i];
      var name = cell(row, map, "name").trim();
      if (!name) continue;
      if (!isYes(cell(row, map, "available"), true)) continue;
      var given = cell(row, map, "id").trim();
      var id = given || slugId(name, used);
      if (given) {
        if (used[id]) id = slugId(name, used);
        else used[id] = true;
      }
      var category = categoryOf(cell(row, map, "category"));
      var sort = Number(asText(cell(row, map, "sort")).replace(/[^\d-]/g, ""));
      items.push({
        id: id,
        name: name,
        blurb: cell(row, map, "description").trim(),
        category: category.id,
        categoryLabel: category.label,
        image: driveImageUrl(cell(row, map, "image").trim()),
        price: parseMoney(cell(row, map, "price")),
        options: parseOptions(cell(row, map, "options")),
        popular: isYes(cell(row, map, "popular"), false),
        noteHint: cell(row, map, "noteHint").trim(),
        sort: Number.isFinite(sort) ? sort : 0
      });
    }
    items.sort(function (a, b) {
      if (a.sort !== b.sort) return a.sort - b.sort;
      return a.name.localeCompare(b.name, "vi");
    });
    return items;
  }

  function productsFromCsv(text) {
    return productsFromRows(parseCsv(text));
  }

  function findChoice(list, value) {
    if (!value || !list) return null;
    var want = String(value);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === want || list[i].label === want) return list[i];
    }
    return null;
  }

  function lineUnitPrice(item, sizeId, toppingIds) {
    var options = (item && item.options) || { sizes: [], toppings: [] };
    var sizes = options.sizes || [];
    var size = findChoice(sizes, sizeId);
    if (!size && sizeId === "S") size = sizes[0];
    if (!size && sizeId === "M") size = sizes[1] || sizes[0];
    if (!size && sizeId === "L") size = sizes[sizes.length - 1];
    if (!size) {
      size = sizes.filter(function (entry) { return Number(entry.extra) === 0; })[0] || { extra: 0 };
    }
    var ids = toppingIds || [];
    var extra = 0;
    (options.toppings || []).forEach(function (topping) {
      if (ids.indexOf(topping.id) !== -1 || ids.indexOf(topping.label) !== -1) extra += Number(topping.price) || 0;
    });
    return Math.max(0, Number(item.price) + (Number(size.extra) || 0) + extra);
  }

  function legacyOptions(item) {
    var food = item && item.category === "food";
    var sizes = (App.SIZES || []).map(function (size) {
      var label = food ? size.food : size.drink;
      return { id: label, label: label, extra: size.extra, price: size.extra };
    });
    var sugar = food ? [] : (App.SUGAR || []).map(function (level) {
      return { id: level.label, label: level.label, extra: 0, price: 0 };
    });
    var ice = food ? [] : (App.ICE || []).map(function (level) {
      return { id: level.label, label: level.label, extra: 0, price: 0 };
    });
    var group = item && item.toppings && App.TOPPINGS ? (App.TOPPINGS[item.toppings] || []) : [];
    var toppings = group.map(function (topping) {
      return { id: topping.name, label: topping.name, extra: topping.price, price: topping.price };
    });
    return { sizes: sizes, sugar: sugar, ice: ice, toppings: toppings };
  }

  function ensureOptions(item) {
    if (!item) return { sizes: [], sugar: [], ice: [], toppings: [] };
    if (!item.options) item.options = legacyOptions(item);
    return item.options;
  }

  function ensureMenu(items) {
    (items || []).forEach(ensureOptions);
    return items || [];
  }

  function defaultChoiceId(list, pred) {
    if (!list || !list.length) return "";
    for (var i = 0; i < list.length; i += 1) {
      if (pred(list[i])) return list[i].id;
    }
    return list[0].id;
  }

  App.foldKey = fold;
  App.parseCsv = parseCsv;
  App.parseMoney = parseMoney;
  App.driveImageUrl = driveImageUrl;
  App.normalizeSpreadsheetId = normalizeSpreadsheetId;
  App.parseOptions = parseOptions;
  App.shopFromRows = shopFromRows;
  App.shopFromCsv = shopFromCsv;
  App.mergeShop = mergeShop;
  App.productsFromRows = productsFromRows;
  App.productsFromCsv = productsFromCsv;
  App.lineUnitPrice = lineUnitPrice;
  App.findChoice = findChoice;
  App.ensureOptions = ensureOptions;
  App.ensureMenu = ensureMenu;
  App.defaultChoiceId = defaultChoiceId;
  App.isYesValue = isYes;
})(typeof window !== "undefined" ? window : globalThis);
