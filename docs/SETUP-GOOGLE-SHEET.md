# Nối A Béo's House với Google Sheet

Sheet đã tạo sẵn, đúng 3 tab `Shop`, `Products`, `Orders` và dữ liệu mẫu. Không cần tạo file mới hay import lại CSV.

Mở sheet: https://docs.google.com/spreadsheets/d/1urtnj8cjDDgCLhLk6NMQsMuEAOHyIv85Vcuo-5q3Lb8/edit

ID (đã ghi trong `js/config.js`): `1urtnj8cjDDgCLhLk6NMQsMuEAOHyIv85Vcuo-5q3Lb8`

Chưa bật chia sẻ công khai thì trang **vẫn mở được**: hiện 19 món mẫu và một dòng vàng “Không tải được Google Sheet”. Link Apps Script đã nằm trong `js/config.js`, nên sau khi share, đặt món sẽ ghi vào tab Orders.

## 1. Chia sẻ để trang web đọc được

1. Trên sheet, **Share** → General access: **Anyone with the link** → **Viewer**.
2. Nếu trang vẫn báo không tải được sheet: **File → Share → Publish to web**, chọn cả file, **Publish**.

Sửa giá, tên, ẩn món (`đang bán` = `ẩn`) trực tiếp trên tab **Products**. Cột **thứ tự** số nhỏ hiện trước. Tab **Orders** đang chỉ có hàng tiêu đề; đơn mới tự thêm phía dưới.

## 2. Ô lựa chọn

Cột `lựa chọn` là một ô nhiều dòng (trong sheet bấm Alt+Enter để xuống dòng):

```text
size: Ly nhỏ -5000 | Ly vừa 0 | Ly lớn +5000
sugar: 0% | 30% | 50% | 70% | 100%
ice: Không đá | Ít đá | Bình thường | Nhiều đá
topping: Trân châu đen +8000 | Thạch trái cây +7000
```

- `size` là cỡ. Số cuối là cộng/trừ vào giá (viết `+5000` hoặc `+5.000`).
- `sugar` và `ice` không có giá. Bỏ hẳn dòng đó nếu món không chọn đường/đá.
- `topping` là món thêm, có giá.
- Các lựa chọn cách nhau bằng dấu `|`.

## 3. Ảnh trên Google Drive

Ảnh mẫu trong repo (`img/ten-mon.jpg`) vẫn hiện được. Khi đổi ảnh:

1. Upload ảnh lên Drive.
2. Chuột phải file → **Share** → **Anyone with the link** → Viewer.
3. Copy link dạng `https://drive.google.com/file/d/xxxxx/view?usp=sharing`.
4. Dán nguyên link vào cột `ảnh`. Trang tự đổi thành ảnh hiện được.

## 4. Apps Script để ghi đơn

1. Trên sheet: **Extensions → Apps Script**.
2. Xóa code sẵn có, dán toàn bộ file `apps-script/Code.gs`, **Save**.
3. **Deploy → New deployment → chọn bánh răng → Web app**.
4. **Execute as: Me**. **Who has access: Anyone**. **Deploy**.
5. Google hỏi quyền: bấm **Authorize**, chọn Gmail của bạn, **Advanced → Go to … → Allow**. Cần quyền sửa sheet **và gửi email**.
6. Copy **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`).

## 5. Email khi có đơn mới

1. Trong tab **Shop**, dòng `notify_email`, cột `value`: email nhận đơn. Nhiều email thì cách nhau bằng dấu phẩy: `ban@gmail.com, bep@gmail.com`. Để trống thì không gửi, không báo lỗi.
2. Thư gửi **từ chính Gmail** đã bấm Allow ở bước trên. Tiêu đề có mã đơn và tổng tiền. Nội dung có tên, số điện thoại, giao/mang về, địa chỉ, món kèm lựa chọn, tiền, cách thanh toán, ghi chú, và link mở sheet.
3. Gmail cá nhân chỉ khoảng **100 email/ngày**. Hết hạn mức thì đơn **vẫn nằm trong tab Orders**; chỉ thiếu thư. Lỗi gửi mail không hủy đơn.
4. Lần deploy đã xin quyền Gmail. Nếu bạn sửa script rồi deploy lại, cứ Allow nếu Google hỏi tiếp.

## 6. Link script trên trang

`spreadsheetId` và `scriptUrl` đã có trong `js/config.js`. Web app đang trả `{"ok":true,"service":"abeos-house"}`. Không cần dán lại, trừ khi bạn deploy bản mới và URL đổi.

```javascript
App.SHEETS = {
  spreadsheetId: "1urtnj8cjDDgCLhLk6NMQsMuEAOHyIv85Vcuo-5q3Lb8",
  scriptUrl: "https://script.google.com/macros/s/AKfycbxL7SeKXn_AjoFtrEFFWEIqS0ShnJKNd_Z06wvCADuUSYJioMY7eJViM-q62jX592fSxg/exec"
};
```

Merge vào `main` rồi đợi GitHub Pages cập nhật trước khi đặt đơn thật.

Đơn thành công thì tab **Orders** có dòng mới, trạng thái `Mới`, và hộp thư có thư nếu đã điền `notify_email`. Trang xác nhận chỉ hiện khi script trả về thành công. Sheet chưa chia sẻ công khai thì thực đơn vẫn là bản mẫu.
