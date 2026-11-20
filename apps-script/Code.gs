/**
 * Web app nhận đơn của A Béo's House.
 * Triển khai: Execute as me, Who has access: Anyone.
 * Body là JSON, Content-Type text/plain (tránh preflight CORS của Apps Script).
 * Giá được tính lại từ tab Products. Email lỗi không làm hỏng đơn.
 *
 * Ô lựa chọn (giống js/sheet-format.js):
 * size: Ly nhỏ -5000 | Ly vừa 0 | Ly lớn +5000
 * sugar: 0% | 30% | 50% | 70% | 100%
 * ice: Không đá | Ít đá | Bình thường | Nhiều đá
 * topping: Trân châu đen +8000 | Thạch trái cây +7000
 */
var ORDER_HEADERS = ["mã đơn", "thời gian", "khách", "điện thoại", "nhận món", "địa chỉ", "món", "tạm tính", "phí giao", "tổng", "thanh toán", "ghi chú", "trạng thái"];

function doGet(e) {
  var code = e && e.parameter ? String(e.parameter.order || "").trim() : "";
  if (!code) return json_({ ok: true, service: "abeos-house" });
  try {
    var orders = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
    var found = orders ? readOrderByCode_(orders, code) : null;
    if (!found) return json_({ ok: true, found: false });
    return json_({ ok: true, order: found });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shop = readShop_(ss.getSheetByName("Shop"));
    var products = indexProducts_(readProducts_(ss.getSheetByName("Products")));
    var orders = ss.getSheetByName("Orders");
    if (!orders) throw new Error("Không thấy tab Orders.");
    ensureOrderHeaders_(orders);
    var requested = String(body.id || "").trim();
    if (/^AB-[A-Z0-9]{4}$/.test(requested)) {
      var existing = readOrderByCode_(orders, requested);
      if (existing) return json_({ ok: true, order: existing, duplicate: true, mail: "skipped" });
    }
    var built = buildOrder_(body, shop, products, existingCodes_(orders));
    orders.appendRow(built.row);
    var mail = "skipped";
    try {
      mail = notifyOrder_(ss, shop, built.order);
    } catch (mailError) {
      mail = "failed";
    }
    return json_({ ok: true, order: built.order, duplicate: false, mail: mail });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fold_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactKey_(value) {
  return fold_(value).replace(/[\s_]+/g, "");
}

function parseMoney_(value) {
  var raw = String(value == null ? "" : value).trim().replace(/\s/g, "").replace(/đ/gi, "");
  if (!raw) return 0;
  var neg = raw.charAt(0) === "-";
  if (raw.charAt(0) === "+" || raw.charAt(0) === "-") raw = raw.slice(1);
  raw = raw.replace(/\./g, "").replace(/,/g, "");
  if (!/^\d+$/.test(raw)) return 0;
  return neg ? -Number(raw) : Number(raw);
}

function isYes_(value, whenBlank) {
  var v = compactKey_(value);
  if (!v) return !!whenBlank;
  if (v === "0" || v === "khong" || v === "an" || v === "hidden" || v === "no" || v === "false" || v === "off") return false;
  if (v === "1" || v === "co" || v === "yes" || v === "true" || v === "on" || v === "dangban") return true;
  return !!whenBlank;
}

function shopField_(key) {
  var map = {
    name: "name", ten: "name", tenquan: "name",
    tagline: "tagline", khauhieu: "tagline",
    address: "address", diachi: "address",
    phone: "phone", dienthoai: "phone", sodienthoai: "phone",
    hours: "hours", giomocua: "hours",
    deliveryfee: "deliveryFee", phigiao: "deliveryFee", phigiaohang: "deliveryFee",
    notifyemail: "notifyEmail", email: "notifyEmail", emailnhandon: "notifyEmail"
  };
  return map[compactKey_(key)] || "";
}

function optionKind_(key) {
  var k = compactKey_(key);
  if (k === "size" || k === "co" || k === "khau" || k === "khauphan") return "size";
  if (k === "sugar" || k === "duong") return "sugar";
  if (k === "ice" || k === "da") return "ice";
  if (k === "topping" || k === "toppings" || k === "them") return "topping";
  return "";
}

function parseChoice_(text) {
  var raw = String(text || "").trim();
  if (!raw) return null;
  var match = raw.match(/^(.*\S)\s+([+-]?\d[\d.]*)$/);
  var label = raw;
  var amount = 0;
  if (match) {
    label = match[1].trim();
    amount = parseMoney_(match[2]);
  }
  if (!label) return null;
  return { id: label, label: label, extra: amount, price: amount };
}

function parseOptions_(text) {
  var options = { sizes: [], sugar: [], ice: [], toppings: [] };
  String(text || "").split(/\r?\n/).forEach(function (line) {
    var trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === "#") return;
    var splitAt = trimmed.indexOf(":");
    if (splitAt === -1) return;
    var kind = optionKind_(trimmed.slice(0, splitAt));
    if (!kind) return;
    trimmed.slice(splitAt + 1).split("|").forEach(function (part) {
      var choice = parseChoice_(part);
      if (!choice) return;
      options[kind === "size" ? "sizes" : kind === "sugar" ? "sugar" : kind === "ice" ? "ice" : "toppings"].push(choice);
    });
  });
  return options;
}

function categoryOf_(value) {
  var v = fold_(value);
  if (!v || v === "drink" || v === "do uong") return { id: "drink", label: "Đồ uống" };
  if (v === "food" || v === "do an") return { id: "food", label: "Đồ ăn" };
  return { id: fold_(value).replace(/[^a-z0-9]+/g, "-"), label: String(value || "").trim() };
}

function headerMap_(headers) {
  var alias = {
    ma: "id", id: "id", ten: "name", name: "name", mota: "description", description: "description",
    nhom: "category", category: "category", anh: "image", image: "image", gia: "price", price: "price",
    luachon: "options", options: "options", dangban: "available", available: "available",
    thutu: "sort", sort: "sort", noibat: "popular", popular: "popular"
  };
  var map = {};
  headers.forEach(function (header, index) {
    var field = alias[compactKey_(header)];
    if (field) map[field] = index;
  });
  return map;
}

function readShop_(sheet) {
  if (!sheet) throw new Error("Không thấy tab Shop.");
  var rows = sheet.getDataRange().getValues();
  var start = rows.length && /^(key|khoa|truong)$/.test(compactKey_(rows[0][0])) ? 1 : 0;
  var bag = {};
  for (var i = start; i < rows.length; i += 1) {
    var field = shopField_(rows[i][0]);
    if (field) bag[field] = String(rows[i][1] == null ? "" : rows[i][1]).trim();
  }
  bag.deliveryFee = parseMoney_(bag.deliveryFee);
  return bag;
}

function readProducts_(sheet) {
  if (!sheet) throw new Error("Không thấy tab Products.");
  var rows = sheet.getDataRange().getValues();
  if (!rows.length) return [];
  var map = headerMap_(rows[0]);
  var items = [];
  for (var i = 1; i < rows.length; i += 1) {
    var row = rows[i];
    var name = map.name == null ? "" : String(row[map.name] || "").trim();
    var id = map.id == null ? "" : String(row[map.id] || "").trim();
    if (!name || !id) continue;
    var category = categoryOf_(map.category == null ? "" : row[map.category]);
    items.push({
      id: id,
      name: name,
      price: parseMoney_(map.price == null ? 0 : row[map.price]),
      available: isYes_(map.available == null ? "" : row[map.available], true),
      category: category.id,
      options: parseOptions_(map.options == null ? "" : row[map.options])
    });
  }
  return items;
}

function indexProducts_(items) {
  var byId = {};
  items.forEach(function (item) { byId[item.id] = item; });
  return byId;
}

function findChoice_(list, value) {
  if (!value) return null;
  var want = String(value);
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].id === want || list[i].label === want) return list[i];
  }
  if (want === "S") return list[0] || null;
  if (want === "M") return list[1] || list[0] || null;
  if (want === "L") return list[list.length - 1] || null;
  return null;
}

function requireChoice_(list, value, emptyMessage, badMessage) {
  if (!list.length) return null;
  var found = findChoice_(list, value);
  if (!found) throw new Error(value ? badMessage : emptyMessage);
  return found;
}

function normalizePhone_(value) {
  var compact = String(value || "").replace(/[\s.\-]/g, "");
  if (/^0\d{9}$/.test(compact)) return compact.slice(0, 4) + " " + compact.slice(4, 7) + " " + compact.slice(7);
  if (/^\+84\d{9}$/.test(compact)) return normalizePhone_("0" + compact.slice(3));
  if (/^84\d{9}$/.test(compact)) return normalizePhone_("0" + compact.slice(2));
  return "";
}

function formatVnd_(amount) {
  var rounded = Math.round(Number(amount) || 0);
  var digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (rounded < 0 ? "-" : "") + digits + "đ";
}

function fulfillmentLabel_(value) {
  if (value === "delivery") return "Giao hàng";
  if (value === "pickup") return "Mang về";
  if (value === "dinein") return "Dùng tại quán";
  return "";
}

function paymentLabel_(value) {
  if (value === "cash") return "Tiền mặt khi nhận";
  if (value === "transfer") return "Chuyển khoản";
  return "";
}

function buildOrder_(body, shop, productsById, existingCodes) {
  var name = String(body.customerName || "").trim();
  var phone = normalizePhone_(body.phone);
  var fulfillment = String(body.fulfillment || "");
  var payment = String(body.payment || "");
  var address = String(body.address || "").trim();
  var note = String(body.note || "").trim().slice(0, 240);
  if (name.length < 2) throw new Error("Thiếu họ tên.");
  if (!phone) throw new Error("Số điện thoại chưa đúng.");
  if (!fulfillmentLabel_(fulfillment)) throw new Error("Hình thức nhận món không hợp lệ.");
  if (fulfillment === "delivery" && address.length < 5) throw new Error("Thiếu địa chỉ giao hàng.");
  if (!paymentLabel_(payment)) throw new Error("Hình thức thanh toán không hợp lệ.");
  var linesIn = Array.isArray(body.lines) ? body.lines : [];
  if (!linesIn.length) throw new Error("Giỏ trống.");
  var lines = linesIn.map(function (raw) {
    var item = productsById[String(raw.id || "")];
    if (!item) throw new Error("Không thấy món: " + String(raw.id || ""));
    if (!item.available) throw new Error("Món đang ẩn: " + item.name);
    var qty = Math.round(Number(raw.qty));
    if (!isFinite(qty) || qty < 1 || qty > 20) throw new Error("Số lượng không hợp lệ.");
    var options = item.options || { sizes: [], sugar: [], ice: [], toppings: [] };
    var size = requireChoice_(options.sizes, raw.size, "Thiếu cỡ của " + item.name + ".", "Cỡ không có trên món " + item.name + ".");
    var sugar = requireChoice_(options.sugar, raw.sugar, "Thiếu mức đường của " + item.name + ".", "Mức đường không có trên món " + item.name + ".");
    var ice = requireChoice_(options.ice, raw.ice, "Thiếu mức đá của " + item.name + ".", "Mức đá không có trên món " + item.name + ".");
    var toppingLabels = [];
    var toppingSum = 0;
    (Array.isArray(raw.toppings) ? raw.toppings : []).forEach(function (label) {
      var topping = findChoice_(options.toppings, label);
      if (!topping) throw new Error("Topping không có trên món " + item.name + ": " + label);
      toppingLabels.push(topping.label);
      toppingSum += Number(topping.price) || 0;
    });
    var unit = Math.max(0, Number(item.price) + (size ? Number(size.extra) || 0 : 0) + toppingSum);
    var lineNote = String(raw.note || "").trim().slice(0, 140);
    return {
      itemId: item.id,
      name: item.name,
      quantity: qty,
      unitPrice: unit,
      size: size ? size.id : "",
      sizeLabel: size ? size.label : "",
      sugar: sugar ? sugar.id : "",
      sugarLabel: sugar ? sugar.label : "",
      ice: ice ? ice.id : "",
      iceLabel: ice ? ice.label : "",
      toppingLabels: toppingLabels,
      note: lineNote
    };
  });
  var subtotal = lines.reduce(function (sum, line) { return sum + line.unitPrice * line.quantity; }, 0);
  var deliveryFee = fulfillment === "delivery" ? Number(shop.deliveryFee) || 0 : 0;
  var total = subtotal + deliveryFee;
  var requested = String(body.id || "").trim();
  var id = /^AB-[A-Z0-9]{4}$/.test(requested) ? requested : makeCode_(existingCodes);
  existingCodes[id] = true;
  var now = new Date();
  var createdAt = now.toISOString();
  var placedAt = formatInVietnam_(now);
  var order = {
    id: id,
    createdAt: createdAt,
    placedAt: placedAt,
    customer: { name: name, phone: phone },
    fulfillment: fulfillment,
    address: fulfillment === "delivery" ? address : "",
    note: note,
    payment: payment,
    lines: lines,
    subtotal: subtotal,
    deliveryFee: deliveryFee,
    total: total,
    sent: true
  };
  return {
    order: order,
    row: [
      id,
      placedAt,
      name,
      phone,
      fulfillmentLabel_(fulfillment),
      order.address,
      lines.map(describeLine_).join("\n"),
      subtotal,
      deliveryFee,
      total,
      paymentLabel_(payment),
      note,
      "Mới"
    ]
  };
}

function describeLine_(line) {
  var bits = [];
  if (line.sizeLabel) bits.push(line.sizeLabel);
  if (line.sugarLabel) bits.push("Đường " + line.sugarLabel);
  if (line.iceLabel) bits.push(line.iceLabel);
  if (line.toppingLabels && line.toppingLabels.length) bits.push(line.toppingLabels.join(", "));
  if (line.note) bits.push("Ghi chú: " + line.note);
  return line.quantity + " × " + line.name + (bits.length ? " (" + bits.join(", ") + ")" : "");
}

function formatInVietnam_(date) {
  var zone = "Asia/Ho_Chi_Minh";
  var pattern = "dd/MM/yyyy HH:mm:ss";
  if (typeof Utilities !== "undefined" && Utilities.formatDate) {
    return Utilities.formatDate(date, zone, pattern);
  }
  return new Date(date).toISOString();
}

function labelToFulfillment_(label) {
  var v = fold_(label);
  if (v === "giao hang" || v === "delivery") return "delivery";
  if (v === "mang ve" || v === "pickup") return "pickup";
  if (v === "dung tai quan" || v === "dinein") return "dinein";
  return String(label || "");
}

function labelToPayment_(label) {
  var v = fold_(label);
  if (v === "tien mat khi nhan" || v === "cash") return "cash";
  if (v === "chuyen khoan" || v === "transfer") return "transfer";
  return String(label || "");
}

function orderFromRow_(row) {
  var subtotal = Number(row[7]) || 0;
  var itemsText = String(row[6] || "");
  var when = row[1];
  var createdAt = when instanceof Date ? when.toISOString() : String(when || "");
  return {
    id: String(row[0] || "").trim(),
    createdAt: createdAt,
    placedAt: createdAt,
    customer: { name: String(row[2] || ""), phone: String(row[3] || "") },
    fulfillment: labelToFulfillment_(row[4]),
    address: String(row[5] || ""),
    note: String(row[11] || ""),
    payment: labelToPayment_(row[10]),
    lines: itemsText ? [{
      name: itemsText,
      quantity: 1,
      unitPrice: subtotal,
      sizeLabel: "",
      sugarLabel: "",
      iceLabel: "",
      toppingLabels: [],
      note: ""
    }] : [],
    subtotal: subtotal,
    deliveryFee: Number(row[8]) || 0,
    total: Number(row[9]) || 0,
    sent: true
  };
}

function readOrderByCode_(sheet, code) {
  var want = String(code || "").trim();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i += 1) {
    if (String(rows[i][0] || "").trim() === want) return orderFromRow_(rows[i]);
  }
  return null;
}

function makeCode_(existing) {
  var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var id = "";
  do {
    id = "AB-";
    for (var i = 0; i < 4; i += 1) id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  } while (existing[id]);
  existing[id] = true;
  return id;
}

function existingCodes_(sheet) {
  var codes = {};
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i += 1) {
    var code = String(rows[i][0] || "").trim();
    if (code) codes[code] = true;
  }
  return codes;
}

function ensureOrderHeaders_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(ORDER_HEADERS);
}

function escapeHtml_(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function notifyAddresses_(shop) {
  return String(shop.notifyEmail || "").split(/[,;]/).map(function (part) {
    return part.trim();
  }).filter(isEmail_);
}

function notifyOrder_(ss, shop, order) {
  var addresses = notifyAddresses_(shop);
  if (!addresses.length) return "skipped";
  var link = "https://docs.google.com/spreadsheets/d/" + ss.getId();
  var items = order.lines.map(function (line) {
    return "<li>" + escapeHtml_(describeLine_(line)) + " — " + escapeHtml_(formatVnd_(line.unitPrice * line.quantity)) + "</li>";
  }).join("");
  var html = "<h2>Đơn " + escapeHtml_(order.id) + "</h2>" +
    "<p><b>Thời gian:</b> " + escapeHtml_(order.placedAt || "") + "</p>" +
    "<p><b>Khách:</b> " + escapeHtml_(order.customer.name) + "<br><b>Điện thoại:</b> " + escapeHtml_(order.customer.phone) + "</p>" +
    "<p><b>Nhận món:</b> " + escapeHtml_(fulfillmentLabel_(order.fulfillment)) +
    (order.address ? "<br><b>Địa chỉ:</b> " + escapeHtml_(order.address) : "") + "</p>" +
    "<ul>" + items + "</ul>" +
    "<p>Tạm tính: " + escapeHtml_(formatVnd_(order.subtotal)) + "<br>Phí giao: " + escapeHtml_(formatVnd_(order.deliveryFee)) +
    "<br><b>Tổng: " + escapeHtml_(formatVnd_(order.total)) + "</b></p>" +
    "<p><b>Thanh toán:</b> " + escapeHtml_(paymentLabel_(order.payment)) + "</p>" +
    (order.note ? "<p><b>Ghi chú:</b> " + escapeHtml_(order.note) + "</p>" : "") +
    '<p><a href="' + escapeHtml_(link) + '">Mở Google Sheet</a></p>';
  var plain = [
    "Đơn " + order.id,
    order.placedAt ? "Thời gian: " + order.placedAt : "",
    "Khách: " + order.customer.name,
    "Điện thoại: " + order.customer.phone,
    "Nhận món: " + fulfillmentLabel_(order.fulfillment),
    order.address ? "Địa chỉ: " + order.address : "",
    order.lines.map(describeLine_).join("\n"),
    "Tạm tính: " + formatVnd_(order.subtotal),
    "Phí giao: " + formatVnd_(order.deliveryFee),
    "Tổng: " + formatVnd_(order.total),
    "Thanh toán: " + paymentLabel_(order.payment),
    order.note ? "Ghi chú: " + order.note : "",
    link
  ].filter(Boolean).join("\n");
  MailApp.sendEmail({
    to: addresses.join(", "),
    subject: "Đơn " + order.id + " — " + formatVnd_(order.total),
    body: plain,
    htmlBody: html
  });
  return "sent";
}
