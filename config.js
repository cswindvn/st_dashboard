/* Cấu hình dùng chung cho paint.html và qc.html (file này công khai — KHÔNG đặt mã QC ở đây) */
window.CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzk8GujKwtCwbPGDtwsP9UjgrZ6rV917FET13BwOLU963kxrnjFaqqkroNFXO1sDEBj/exec",        // URL Apps Script Web App (.../exec). Để trống = dữ liệu demo.
  API_KEY: "",        // Khoá trang đội sơn (khớp CONFIG.API_KEY trong Code.gs, nếu có)
  QC_KEY: "",         // Không điền: trang QC sẽ hỏi mã khi mở lần đầu (khớp CONFIG.QC_KEY trong Code.gs)
  // Nút "Thư mục ảnh" ở đầu trang. Thư mục gốc Drive chứa thư mục con theo TÊN INSPECTOR → trang đội sơn để trống để không lộ tên.
  PHOTO_ROOT_PAINT: "",
  // Địa chỉ site đội sơn, để trang QC có nút chuyển sang (để trống = ẩn nút). Có thể điền tự động: node tools/build-dist.js --paint-url=https://...
  SNAPSHOT: false,     // true = khi chưa có API_URL, đọc data/qc.json và data/paint.json (ảnh chụp dữ liệu thật, chỉ để xem thử cục bộ; KHÔNG đưa thư mục data lên web công khai)
  REFRESH_MS: 5 * 60 * 1000,
  PAGE_SIZE: 25,
  WEEKLY_TARGET: 2    // KPI: số issue tối thiểu mỗi inspector mỗi tuần (tuần = Thứ 2 → Chủ nhật)
};
