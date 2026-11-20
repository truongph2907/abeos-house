# Nối A Béo's House với Google Sheet

Trang đọc tên quán và thực đơn từ Google Sheet. Đơn đặt được ghi thêm một dòng, rồi gửi email nếu bạn điền địa chỉ nhận. Không cần API key.

Làm một lần, khoảng 15 phút. File mẫu nằm trong thư mục `templates/`.

## 1. Tạo sheet và 3 tab

1. Vào [Google Sheet](https://sheets.google.com) → **Blank spreadsheet**.
2. Đổi tên tab đầu thành đúng chữ `Shop`.
3. Bấm dấu **+** ở dưới, thêm tab `Products`, rồi tab `Orders`. Tên phải đúng từng chữ, kể cả hoa thường.

## 2. Nhập dữ liệu mẫu

Với từng tab:

1. Bấm vào tab đó.
2. **File → Import → Upload** file CSV tương ứng (`shop.csv`, `products.csv`, `orders.csv`).
3. Import location: **Replace current sheet**. Separator: **Comma**.
4. **Import data**.

Đừng chọn *Replace spreadsheet* — lựa chọn đó xóa các tab khác.

Tab **Shop** là từng dòng `key` / `value` (tên quán, điện thoại, địa chỉ, giờ, phí giao, tài khoản). Tab **Products** là 19 món mẫu. Tab **Orders** chỉ có hàng tiêu đề; đơn mới sẽ tự thêm phía dưới.

Sửa giá, tên, ẩn món (`đang bán` = `ẩn`) trực tiếp trên sheet. Cột **thứ tự** số nhỏ hiện trước.

## 3. Ô lựa chọn

Cột `lựa chọn` là một ô nhiều dòng (trong sheet bấm Alt+Enter để xuống dòng):

```text
size: Ly nhỏ -5000 | Ly vừa 0 | Ly lớn +5000
sugar: 0% | 30% | 50% | 70% | 100%
ice: Không đá | Ít đá | Bình thường | Nhiều đá
topping: Trân châu đen +8000 | Thạch trái cây +7000
```

- `size` là cỡ. Số cuối là cộng/trừ vào giá (viết `+5000` hoặc `+5.000`).
- `sugar` và `ice` không có giá. Bỏ hẳn dòng đó nếu món không chọn đường/đá (đồ ăn).
- `topping` là món thêm, có giá.
- Các lựa chọn cách nhau bằng dấu `|`.

## 4. Chia sẻ để trang web đọc được

1. **Share** → General access: **Anyone with the link** → **Viewer**.
2. Nếu trang báo không tải được sheet: **File → Share → Publish to web**, chọn cả file, **Publish**.

Copy ID trong địa chỉ sheet:

`https://docs.google.com/spreadsheets/d/` **`ID_NAY`** `/edit`

## 5. Ảnh trên Google Drive

1. Upload ảnh lên Drive.
2. Chuột phải file → **Share** → **Anyone with the link** → Viewer.
3. Copy link dạng `https://drive.google.com/file/d/xxxxx/view?usp=sharing`.
4. Dán nguyên link vào cột `ảnh`. Trang tự đổi thành ảnh hiện được.

Ảnh mẫu trong repo (`img/ten-mon.jpg`) vẫn dùng được nếu bạn để nguyên đường dẫn đó.

## 6. Apps Script để ghi đơn

1. Trên sheet: **Extensions → Apps Script**.
2. Xóa code sẵn có, dán toàn bộ file `apps-script/Code.gs`, **Save** (đặt tên project tùy ý).
3. **Deploy → New deployment → chọn bánh răng → Web app**.
4. **Execute as: Me**. **Who has access: Anyone**. **Deploy**.
5. Google hỏi quyền: bấm **Authorize**, chọn Gmail của bạn, **Advanced → Go to … → Allow**. Cần quyền sửa sheet **và gửi email**.
6. Copy **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`).

## 7. Email khi có đơn mới

1. Trong tab **Shop**, dòng `notify_email`, cột `value`: email nhận đơn. Nhiều email thì cách nhau bằng dấu phẩy: `ban@gmail.com, bep@gmail.com`. Để trống thì không gửi, không báo lỗi.
2. Thư gửi **từ chính Gmail** đã bấm Allow ở bước trên. Tiêu đề có mã đơn và tổng tiền. Nội dung có tên, số điện thoại, giao/mang về, địa chỉ, món kèm lựa chọn, tiền, cách thanh toán, ghi chú, và link mở sheet.
3. Gmail cá nhân chỉ khoảng **100 email/ngày**. Hết hạn mức thì đơn **vẫn nằm trong tab Orders**; chỉ thiếu thư. Lỗi gửi mail không hủy đơn.
4. Lần deploy đã xin quyền Gmail. Nếu bạn sửa script rồi deploy lại, cứ Allow nếu Google hỏi tiếp.

## 8. Dán vào trang

Mở `js/config.js`, điền đúng hai dòng (có thể dán cả URL sheet, trang tự lấy ID):

```javascript
App.SHEETS = {
  spreadsheetId: "ID_NAY",
  scriptUrl: "https://script.google.com/macros/s/.../exec"
};
```

Đưa file này lên GitHub (commit vào nhánh `main`, hoặc sửa trực tiếp trên github.com). Đợi GitHub Pages cập nhật, rồi đặt thử một đơn.

Đơn thành công thì tab **Orders** có dòng mới, trạng thái `Mới`, và hộp thư có thư nếu đã điền `notify_email`. Trang xác nhận chỉ hiện khi script trả về thành công. Sai mạng hoặc script lỗi thì giỏ vẫn còn và có dòng báo lỗi.

Chưa điền `spreadsheetId` thì trang dùng 19 món mẫu. Chưa điền `scriptUrl` thì bấm đặt món sẽ báo chưa nối sheet, không hiện mã đơn giả.
