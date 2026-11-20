/* 19 món mẫu: 12 đồ uống, 7 đồ ăn. Giá trên thẻ là cỡ M. */
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

App.MENU = [
  {
    id: "cf-sua-da",
    name: "Cà phê sữa đá",
    category: "drink",
    price: 29000,
    blurb: "Phin đậm pha chậm, sữa đặc và đá. Ly quen nhất quán.",
    emoji: "☕",
    accent: "#F0D7C6",
    popular: true,
    toppings: "drink"
  },
  {
    id: "cf-den-da",
    name: "Cà phê đen đá",
    category: "drink",
    price: 25000,
    blurb: "Đắng vừa, hậu ngọt, không sữa.",
    emoji: "☕",
    accent: "#E7D2C2",
    toppings: "drink"
  },
  {
    id: "bac-xiu",
    name: "Bạc xỉu",
    category: "drink",
    price: 32000,
    blurb: "Nhiều sữa, ít cà phê — nhẹ và béo.",
    emoji: "🥛",
    accent: "#F6E4D4",
    toppings: "drink"
  },
  {
    id: "cf-muoi",
    name: "Cà phê muối",
    category: "drink",
    price: 35000,
    blurb: "Kem muối mặn ngọt, cà phê đậm nằm bên dưới.",
    emoji: "✨",
    accent: "#F3DCC8",
    toppings: "drink"
  },
  {
    id: "tra-dao",
    name: "Trà đào cam sả",
    category: "drink",
    price: 39000,
    blurb: "Trà đào, cam tươi và sả. Uống lạnh là đúng.",
    emoji: "🍑",
    accent: "#F8D7C6",
    popular: true,
    toppings: "drink"
  },
  {
    id: "ts-tran-chau",
    name: "Trà sữa trân châu",
    category: "drink",
    price: 45000,
    blurb: "Trà sữa béo. Thêm trân châu nếu muốn dai.",
    emoji: "🧋",
    accent: "#F6E0C8",
    popular: true,
    toppings: "drink"
  },
  {
    id: "ts-khoai-mon",
    name: "Trà sữa khoai môn",
    category: "drink",
    price: 45000,
    blurb: "Khoai môn tím, béo, ngọt dịu.",
    emoji: "🍠",
    accent: "#E7D8F0",
    toppings: "drink"
  },
  {
    id: "matcha-latte",
    name: "Matcha latte",
    category: "drink",
    price: 49000,
    blurb: "Matcha đánh với sữa tươi, đắng nhẹ.",
    emoji: "🍵",
    accent: "#DCE8CF",
    popular: true,
    toppings: "drink"
  },
  {
    id: "cacao-da",
    name: "Cacao sữa đá",
    category: "drink",
    price: 35000,
    blurb: "Cacao đậm, sữa và đá xay nhẹ.",
    emoji: "🍫",
    accent: "#EAD6C6",
    toppings: "drink"
  },
  {
    id: "sinh-to-bo",
    name: "Sinh tố bơ",
    category: "drink",
    price: 42000,
    blurb: "Bơ sáp xay sữa đặc, sánh và mát.",
    emoji: "🥑",
    accent: "#E4EBCB",
    toppings: "drink"
  },
  {
    id: "ep-cam",
    name: "Nước ép cam",
    category: "drink",
    price: 35000,
    blurb: "Cam vắt, không thêm nước đường.",
    emoji: "🍊",
    accent: "#F8E3C0",
    toppings: "drink"
  },
  {
    id: "sua-chua",
    name: "Sữa chua việt quất",
    category: "drink",
    price: 38000,
    blurb: "Sữa chua nhà làm, mứt việt quất chua ngọt.",
    emoji: "🫐",
    accent: "#F0D5E0",
    toppings: "drink"
  },
  {
    id: "banh-mi",
    name: "Bánh mì thịt nướng",
    category: "food",
    price: 35000,
    blurb: "Thịt nướng, đồ chua, rau và nước sốt.",
    emoji: "🥖",
    accent: "#F6DCC4",
    popular: true,
    toppings: "meal",
    noteHint: "Ví dụ: không rau, thêm ớt"
  },
  {
    id: "xoi-man",
    name: "Xôi mặn thập cẩm",
    category: "food",
    price: 30000,
    blurb: "Xôi dẻo, chà bông, lạp xưởng, mỡ hành.",
    emoji: "🍙",
    accent: "#F3E6C8",
    toppings: "meal",
    noteHint: "Ví dụ: ít mỡ hành"
  },
  {
    id: "com-tam",
    name: "Cơm tấm sườn bì",
    category: "food",
    price: 55000,
    blurb: "Sườn nướng, bì, mỡ hành, nước mắm chua ngọt.",
    emoji: "🍖",
    accent: "#F6D8C4",
    popular: true,
    toppings: "meal",
    noteHint: "Ví dụ: không bì, thêm nước mắm"
  },
  {
    id: "mi-cay",
    name: "Mì cay bò",
    category: "food",
    price: 59000,
    blurb: "Mì cay mức vừa, bò và rau. Ghi chú nếu muốn ít cay.",
    emoji: "🍜",
    accent: "#F8D5CC",
    toppings: "spicy",
    noteHint: "Ví dụ: cay ít, không nấm"
  },
  {
    id: "khoai-tay",
    name: "Khoai tây lắc phô mai",
    category: "food",
    price: 29000,
    blurb: "Khoai chiên giòn, lắc bột phô mai.",
    emoji: "🍟",
    accent: "#F8E6C4",
    toppings: "snack",
    noteHint: "Ví dụ: ít bột phô mai"
  },
  {
    id: "banh-flan",
    name: "Bánh flan caramel",
    category: "food",
    price: 22000,
    blurb: "Flan mịn, caramel đắng nhẹ.",
    emoji: "🍮",
    accent: "#F6E6C8",
    toppings: null
  },
  {
    id: "banh-chuoi",
    name: "Bánh chuối nướng",
    category: "food",
    price: 25000,
    blurb: "Chuối già nướng, nước cốt dừa.",
    emoji: "🍌",
    accent: "#F8ECC4",
    toppings: null,
    noteHint: "Ví dụ: ít dừa"
  }
];
