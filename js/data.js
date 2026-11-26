/* Nhóm và bảng lựa chọn dự phòng khi món không có ô options. Thực đơn lấy từ API. */
window.App = window.App || {};

App.CATEGORIES = [
  { id: "drink", label: "Đồ uống" },
  { id: "food", label: "Đồ ăn" }
];

App.SIZES = [
  { id: "S", drink: "Ly nhỏ", food: "Phần nhỏ", extra: -5000 },
  { id: "M", drink: "Ly vừa", food: "Phần vừa", extra: 0 },
  { id: "L", drink: "Ly lớn", food: "Phần lớn", extra: 5000 }
];

App.SUGAR = [
  { id: "0", label: "0%" },
  { id: "30", label: "30%" },
  { id: "50", label: "50%" },
  { id: "70", label: "70%" },
  { id: "100", label: "100%" }
];

App.ICE = [
  { id: "none", label: "Không đá" },
  { id: "less", label: "Ít đá" },
  { id: "normal", label: "Bình thường" },
  { id: "more", label: "Nhiều đá" }
];

App.TOPPINGS = {
  drink: [
    { id: "tc-den", name: "Trân châu đen", price: 8000 },
    { id: "tc-trang", name: "Trân châu trắng", price: 8000 },
    { id: "thach", name: "Thạch trái cây", price: 7000 },
    { id: "pudding", name: "Pudding trứng", price: 8000 },
    { id: "cheese", name: "Kem cheese", price: 12000 }
  ],
  meal: [
    { id: "trung", name: "Thêm trứng ốp la", price: 8000 },
    { id: "cha", name: "Thêm chả", price: 10000 },
    { id: "pate", name: "Thêm pate", price: 6000 }
  ],
  spicy: [
    { id: "trung", name: "Thêm trứng", price: 8000 },
    { id: "bo", name: "Thêm bò", price: 20000 },
    { id: "pho-mai", name: "Phô mai", price: 8000 }
  ],
  snack: [
    { id: "pho-mai", name: "Thêm phô mai", price: 8000 }
  ]
};

App.MENU = [];
