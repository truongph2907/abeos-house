/* Chỗ duy nhất để nối API. */
window.App = window.App || {};

App.API_BASE = "https://abeos-house-192995384109.asia-southeast1.run.app";

/* Chữ dự phòng khi API để trống ảnh hoặc khẩu hiệu. Thực đơn và phí giao lấy từ API. */
App.SHOP = {
  name: "A Béo's House",
  tagline: "Đồ uống và đồ ăn nhà làm, ấm như ghé nhà người quen.",
  heroImage: "img/cf-sua-da.jpg",
  heroCaption: "Cà phê sữa đá",
  logo: "",
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
    note: "Số tài khoản này chỉ là placeholder. Chủ quán thay số thật trước khi khách chuyển khoản."
  }
};
