# A Béo's House

Trang đặt món tĩnh cho quán đồ uống và đồ ăn **A Béo's House**. Giao diện tiếng Việt, giá tiền Việt Nam (ví dụ `29.000đ`), giỏ hàng và thanh toán chạy trên trình duyệt bằng `localStorage`.

Sau khi bật GitHub Pages, trang nằm tại [https://truongph2907.github.io/abeos-house/](https://truongph2907.github.io/abeos-house/).

## Xem trên máy, đúng subpath `/abeos-house/`

Mọi liên kết và file tĩnh dùng đường dẫn tương đối, nên site chạy khi được phục vụ dưới thư mục `/abeos-house/`:

```bash
mkdir -p /tmp/pages
ln -sfn "$(pwd)" /tmp/pages/abeos-house
python3 -m http.server 8765 --directory /tmp/pages
```

Mở http://localhost:8765/abeos-house/

## Trang

- `index.html` — trang chủ
- `menu.html` — thực đơn, tìm kiếm không phân biệt dấu, chọn món
- `cart.html` — giỏ hàng
- `checkout.html` — thông tin nhận và thanh toán
- `order.html` — xác nhận đơn

Khi thêm món, hộp chọn có cỡ S/M/L, đường, đá (với đồ uống), topping, số lượng và ghi chú.

## Sửa quán và thực đơn

- `js/config.js` — dán `spreadsheetId` và `scriptUrl`. `App.SHOP` chỉ là bản mẫu khi chưa nối sheet.
- `js/data.js` — 19 món mẫu (12 đồ uống, 7 đồ ăn), dùng khi sheet trống hoặc lỗi.
- Cách tạo Google Sheet, Apps Script và email báo đơn: [docs/SETUP-GOOGLE-SHEET.md](docs/SETUP-GOOGLE-SHEET.md).
- `css/styles.css` — màu và kiểu, biến ở `:root`. Giao diện theo quán hẻm: mái hiên vàng đỏ, bảng hiệu, ảnh món thật.
- `img/` — ảnh món từ Wikimedia Commons (giấy phép tự do). Đường dẫn tương đối `img/….jpg`.

Khi đã dán link Apps Script, bấm đặt món sẽ ghi một dòng vào tab Orders (giá tính lại trên script) và gửi email nếu tab Shop có `notify_email`. Chưa cấu hình thì trang vẫn mở bằng thực đơn mẫu, và đặt món báo lỗi thay vì báo thành công.

## GitHub Pages

File `.nojekyll` ở gốc repo để Pages không chạy Jekyll. Site phục vụ từ **gốc repo** trên nhánh `main`.

Sau khi merge, chủ repo cần bật Pages nếu chưa bật:

**Settings → Pages → Build and deployment → Deploy from a branch → Branch: `main` → Folder: `/ (root)` → Save.**

Agent không bật được Pages từ đây (GitHub CLI của môi trường này chỉ đọc).
