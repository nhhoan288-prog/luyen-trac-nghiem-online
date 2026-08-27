# HỆ THỐNG THI TRẮC NGHIỆM NỘI BỘ REALTIME – LAN SERVER/CLIENT

Hệ thống thi trắc nghiệm trực tiếp giữa nhiều đội thi (tối thiểu 20 đội, 20 câu hỏi) hoạt động trong mạng LAN nội bộ độc lập, không phụ thuộc vào kết nối Internet ra ngoài.

---

## 1. KIẾN TRÚC TỔNG QUAN

Hệ thống gồm 3 phân hệ chính hoạt động trên nền tảng **Server-Authoritative**:

1. **SERVER (Máy chủ điều khiển & WebSocket Hub)**:
   - Là "Nguồn chân lý duy nhất" (Single Source of Truth).
   - Kiểm soát đồng hồ đếm ngược mili-giây, phân giải thứ tự nộp bài đồng thời (`sequence number`), xác định tính đúng/sai và tính điểm.
   - Lưu trữ bền vững dữ liệu câu hỏi, đội thi, điểm số và nhật ký sự kiện (`data/quiz_database.json`).
   - Có cơ chế tự khôi phục trạng thái (State Recovery) khi khởi động lại máy chủ.

2. **CLIENT (Giao diện Đội thi - `/team`)**:
   - Nhận câu hỏi trực tiếp từ Server khi phiên câu hỏi bắt đầu.
   - Không chứa đáp án đúng hay logic tính điểm (bảo mật tuyệt đối).
   - 4 phím đáp án lớn (A, B, C, D) khóa ngay lập tức sau khi gửi đáp án (Single-Answer Lock).
   - Chống đăng nhập đồng thời 2 thiết bị cho cùng một đội (Collision Prevention).

3. **DISPLAY (Màn hình trình chiếu Sân khấu - `/display`)**:
   - Tối ưu cho màn hình lớn / Máy chiếu 1920x1080 (nhấn F11 để vào toàn màn hình).
   - 5 trạng thái hiển thị động: Màn hình chờ, Câu hỏi & Đồng hồ đếm ngược, Hết giờ, Công bố đáp án & Đội nhanh nhất (Spotlight Banner), Bảng tổng sắp & Vinh danh Quán quân (Pháo hoa Confetti).

---

## 2. HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH MẠNG LAN

### Bước 1: Khởi chạy máy chủ Server
- Trên máy tính Server (Windows, macOS hoặc Linux):
```bash
npm install
npm run dev
```
- Máy chủ sẽ lắng nghe đồng thời HTTP REST API và WebSocket trên cổng **3000**.

### Bước 2: Xác định địa chỉ IP máy chủ
- Trên **Windows**: Mở `Command Prompt` (cmd) và gõ:
  ```cmd
  ipconfig
  ```
  Tìm mục **IPv4 Address** (Ví dụ: `192.168.1.100` hoặc `10.0.0.15`).
- Trên **Linux / macOS**:
  ```bash
  ifconfig || ip a
  ```

### Bước 3: Cấu hình Tường lửa (Windows Firewall)
- Nếu các máy Client không truy cập được vào Server, hãy mở cổng 3000 TCP:
  - Vào **Windows Defender Firewall with Advanced Security**.
  - Chọn **Inbound Rules** → **New Rule** → Chọn **Port** → Chọn **TCP**, nhập `3000` → Chọn **Allow the connection**.

### Bước 4: Truy cập từ các thiết bị
- **Máy Quản trị (Admin)**: `http://localhost:3000/admin` (Mật khẩu mặc định: `admin123`).
- **Máy Đội thi (Client)**: `http://<IP_MAY_CHU>:3000/team` (Ví dụ: `http://192.168.1.100:3000/team`).
- **Màn hình Sân khấu (Display)**: `http://<IP_MAY_CHU>:3000/display`.

---

## 3. CÁC TÍNH NĂNG CHÍNH ĐÃ HOÀN THIỆN

- ✅ **Server-Authoritative Clock Engine**: Đồng hồ đếm ngược chạy ở Server với độ trễ thấp, Client chỉ hiển thị dựa trên nhịp đập từ Server.
- ✅ **Single-Answer Lock**: Mỗi đội chỉ được gửi đáp án 1 lần duy nhất trong mỗi câu hỏi.
- ✅ **Fastest-Team Spotlight**: Tự động xác định đội trả lời đúng với thời gian mili-giây ngắn nhất kèm điểm thưởng.
- ✅ **Quản lý 20 Đội & 20 Câu hỏi mẫu**: Đầy đủ CRUD đội thi, ngân hàng câu hỏi, nạp lại dữ liệu mẫu 1-click.
- ✅ **Xếp hạng & Thống kê chi tiết**: Tổng điểm, số câu đúng, số câu sai, số câu chưa trả lời, tốc độ phản hồi trung bình.
- ✅ **Xuất báo cáo**: Xuất kết quả xếp hạng và toàn bộ nhật ký sự kiện ra định dạng **CSV / Excel**.
- ✅ **Mô phỏng thi đấu (Simulator)**: Chức năng test giả lập 10 - 20 đội gửi đáp án đồng thời với độ trễ ngẫu nhiên.
- ✅ **Âm thanh tổng hợp (Web Audio API)**: Hiệu ứng âm thanh khi bắt đầu câu hỏi, 3 giây đếm ngược cảnh báo, hết giờ, công bố đáp án và vinh danh chiến thắng (không cần tải file âm thanh ngoài).
"# luyen-trac-nghiem-online" 
