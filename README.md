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
- `orders.html` — đơn đã đặt trên máy này (Đơn của tôi)

Khi thêm món, hộp chọn có cỡ S/M/L, đường, đá (với đồ uống), topping, số lượng và ghi chú.

## Quán, thực đơn và đơn hàng

Địa chỉ API nằm một chỗ: `App.API_BASE` trong `js/config.js`. Trang gọi:

- `GET /api/shop` — tên quán, giờ, phí giao, ảnh, tài khoản
- `GET /api/products` — món đang bán. Ô `options` vẫn là chữ nhiều dòng (`size: … | …`)
- `POST /api/orders` — gửi đơn. Máy chủ tính giá và phí giao. Gửi lại cùng mã `AB-XXXX` và cùng số điện thoại không tạo đơn mới
- `GET /api/orders/{code}?phone=` — đủ chi tiết khi số khớp; không có số thì chỉ trạng thái và tổng tiền

Máy chủ lạnh có thể mất vài giây. Trang hiện “Đang tải thực đơn…” và, khi mất mạng, một dòng nhắc thử lại. Lỗi kiểm tra dữ liệu hiện bằng tiếng Việt.

`App.SHOP` trong `js/config.js` chỉ lấp chữ hoặc ảnh mà API để trống. Khóa `logo` đổi huy hiệu **AB**; để trống thì giữ nguyên. Sửa thực đơn và thông tin quán trên backend, không sửa file tĩnh.

Đơn đã gửi nằm trong `localStorage` khóa `abeos.orders.v1` (Đơn của tôi). Giá trên màn xác nhận là giá máy chủ trả về.

## Giao diện

- `css/styles.css` — màu và kiểu, biến ở `:root`. Giao diện theo quán hẻm: mái hiên vàng đỏ, bảng hiệu, ảnh món thật.
- `img/` — ảnh món từ Wikimedia Commons (giấy phép tự do). Đường dẫn tương đối `img/….jpg`.

## GitHub Pages

File `.nojekyll` ở gốc repo để Pages không chạy Jekyll. Site phục vụ từ **gốc repo** trên nhánh `main`.

Sau khi merge, chủ repo cần bật Pages nếu chưa bật:

**Settings → Pages → Build and deployment → Deploy from a branch → Branch: `main` → Folder: `/ (root)` → Save.**

Agent không bật được Pages từ đây (GitHub CLI của môi trường này chỉ đọc).
