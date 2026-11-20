/* Chỗ duy nhất để nối Google Sheet. Xem docs/SETUP-GOOGLE-SHEET.md.
   spreadsheetId và scriptUrl đã có. Sheet chưa chia sẻ công khai thì trang dùng thực đơn mẫu trong js/data.js. */
window.App = window.App || {};

App.SHEETS = {
  spreadsheetId: "1urtnj8cjDDgCLhLk6NMQsMuEAOHyIv85Vcuo-5q3Lb8",
  scriptUrl: "https://script.google.com/macros/s/AKfycbxL7SeKXn_AjoFtrEFFWEIqS0ShnJKNd_Z06wvCADuUSYJioMY7eJViM-q62jX592fSxg/exec"
};

/* Bản mẫu khi chưa điền spreadsheetId, hoặc khi không tải được sheet. */
App.SHOP = {
  name: "A Béo's House",
  tagline: "Đồ uống và đồ ăn nhà làm, ấm như ghé nhà người quen.",
  heroImage: "img/cf-sua-da.jpg",
  heroCaption: "Cà phê sữa đá",
  address: "42 Nguyễn Văn Linh, Tân Thuận Tây, Quận 7, TP. Hồ Chí Minh",
  phone: "0901 234 567",
  phoneTel: "+84901234567",
  hours: "7:00 – 22:00, tất cả các ngày",
  deliveryFee: 15000,
  bank: {
    bankName: "Vietcombank",
    accountNumber: "0000000000",
    accountName: "A BEO HOUSE",
    branch: "Chi nhánh mẫu",
    placeholder: true,
    note: "Số tài khoản này chỉ là placeholder. Chủ quán thay số thật ở tab Shop trước khi khách chuyển khoản."
  }
};
