/* Chỗ duy nhất để nối Google Sheet. Xem docs/SETUP-GOOGLE-SHEET.md.
   Để trống nếu muốn dùng thông tin và thực đơn mẫu bên dưới / js/data.js. */
window.App = window.App || {};

App.SHEETS = {
  spreadsheetId: "",
  scriptUrl: ""
};

/* Bản mẫu khi chưa điền spreadsheetId, hoặc khi không tải được sheet. */
App.SHOP = {
  name: "A Béo's House",
  tagline: "Đồ uống và đồ ăn nhà làm, ấm như ghé nhà người quen.",
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
