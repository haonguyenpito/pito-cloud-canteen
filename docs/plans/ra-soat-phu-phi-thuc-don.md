# Phụ phí theo thực đơn: những tình huống chưa được xử lý

Rà soát lại kế hoạch "Phụ phí theo thực đơn (phí phụ thu)" và phần mã nguồn đã lên `main`.
Kế hoạch gốc đúng về mặt thiết kế, nhưng còn 16 tình huống chưa được xử lý — trong đó 3 tình
huống gây sai tiền mà không có dấu hiệu nào để phát hiện. (Cập nhật 30/09/2026: thêm mục 15 và 16,
ghi nhận quyết định của PO cho mục 1 và 3.)

| | |
| --- | --- |
| **Phạm vi** | Toàn bộ 5 giai đoạn (đã merge — `b59a659ff`) |
| **Nhánh rà soát** | `main` tại `2a53cf40a` |
| **Ngày** | 17/09/2026 |
| **Trạng thái** | Đang chạy production |

---

## Ba việc cần PO quyết

1. ~~**Đơn hàng "thường" (không cho nhân viên tự chọn món) hiện không hề thu phụ phí.**~~
   **Đã quyết (30/09/2026): thu phụ phí nếu thực đơn có.** Xem thiết kế và các đợt triển khai ở
   mục 1.
2. ~~**Đã duyệt thực đơn là khoá phụ phí vĩnh viễn — không có đường sửa sai.**~~
   **Đã quyết (30/09/2026): đúng — đây là quy tắc chủ đích, giữ nguyên.** Không làm đường sửa sau
   duyệt; sai thì từ chối và nhờ đối tác gửi lại. Hệ quả: mục 5 và 6 trở thành chốt chặn duy nhất,
   xem mục 3.
3. ~~**Phụ phí (biên lợi nhuận của PITO) đang nằm ở dữ liệu công khai của thực đơn** — đối tác và
   khách hàng đều có thể đọc được qua API. Cần quyết: đây có phải thông tin mật hay không.~~
   **Đã quyết (04/10/2026): đúng là dữ liệu công khai, không phải thông tin mật — không cần sửa.**
   Xem mục 10.

---

## Bảng tổng hợp

Xếp theo mức độ ưu tiên xử lý. "Nghiêm trọng" = gây sai tiền hoặc mất dữ liệu mà không có cảnh báo.

| # | Vấn đề | Mức độ | Ảnh hưởng |
| --- | --- | --- | --- |
| 1 | ~~Đơn hàng "thường" không tính phụ phí vào tiền khách trả~~ — **đã xử lý 04/10/2026 (đợt 1a–1d)** | **Nghiêm trọng** | Thất thoát doanh thu, âm thầm |
| 2 | ~~Phụ phí cũ "sống lại" khi món bị gỡ rồi thêm lại vào thực đơn~~ — **đã xử lý 05/10/2026** | **Nghiêm trọng** | Tính sai giá cho khách |
| 3 | ~~Đã duyệt là khoá phụ phí, không có cách sửa sai~~ — **đóng, PO xác nhận là chủ đích** | — | Không xử lý |
| 4 | Đối tác gửi duyệt lại thực đơn ⇒ đơn nháp của khách bị đổi giá âm thầm | Vận hành | Khách thấy giá khác lúc họ duyệt |
| 5 | ~~Duyệt thực đơn chưa nhập phụ phí: không có cảnh báo nào~~ — **đã xử lý 04/10/2026** | Vận hành | Mất phần lợi nhuận cả kỳ thực đơn |
| 6 | ~~Nhập dở dang bị mất khi rời trang, mà nút Duyệt lại ở trang khác~~ — **đóng, PO giữ nghiệp vụ hiện tại** | — | Không xử lý |
| 7 | ~~Đồng bộ giá chỉ chạy trên 100 đơn đầu tiên~~ — **đã xử lý 04/10/2026** | Kỹ thuật | Một số đơn giữ giá cũ |
| 8 | ~~Áp phụ phí hàng loạt lỗi giữa chừng: không biết menu nào đã áp~~ — **đóng, PO giữ nghiệp vụ hiện tại** | — | Không xử lý |
| 9 | Nhập sai (số âm, món không thuộc menu) vẫn báo "đã lưu" | Chất lượng | Admin tưởng đã lưu |
| 10 | ~~Phụ phí là dữ liệu công khai của thực đơn~~ — **đóng, PO xác nhận không phải thông tin mật** | — | Không xử lý |
| 11 | Áp hàng loạt một mức phí xung đột với cơ chế gợi ý nhà hàng "khớp đúng gói" — *chờ PO xác nhận, đã có cách A/B* | Sản phẩm | Thực đơn biến mất khỏi gợi ý |
| 12 | ~~Bộ lọc ngân sách vẫn lọc theo giá gốc~~ — **đã sửa code 05/10/2026, chờ chạy bù dữ liệu production** | Sản phẩm | Nhà hàng hiện ra nhưng không món nào chọn được |
| 13 | ~~Công ty chọn 2 món: phụ phí chia đôi không làm tròn~~ — **đóng, PO giữ nghiệp vụ hiện tại** | — | Không xử lý |
| 14 | ~~Thực đơn xoay vòng: một món chỉ có đúng một mức phí~~ — **đóng, PO xác nhận đúng nghiệp vụ** | — | Không xử lý |
| 15 | ~~Huỷ một ngày giao ⇒ tổng tiền khách bị tính lại **không có phụ phí** (mọi loại đơn)~~ — **đã xử lý 02/10/2026 (đợt 1b)** | **Nghiêm trọng** | Thất thoát doanh thu, âm thầm |
| 16 | ~~Màn hình và email của đối tác hiển thị tổng tiền **đã cộng phụ phí** (đơn nhóm)~~ — **đã xử lý 02/10/2026 (đợt 1b)** | Kinh doanh | Lộ biên lợi nhuận cho đối tác |

Mục 15 và 16 được phát hiện ngày 30/09/2026 khi thiết kế phần sửa cho mục 1 — xem mục 1.

---

## A. Thất thoát doanh thu

### 1. Đơn hàng "thường" không bao giờ thu phụ phí — **Nghiêm trọng**

Với đơn hàng mà nhân viên *không* tự chọn món (admin chốt sẵn món và số lượng), tiền khách phải
trả được tính từ danh sách dòng hàng — và dòng hàng chỉ mang **giá gốc của đối tác**. Phụ phí được
tính ra rồi bị bỏ đi ngay tại đó.

Nghĩa là: admin nhìn thấy giá đã cộng phụ phí trên màn hình tạo đơn, nhưng hoá đơn gửi khách lại
không có phần đó. Không màn hình nào hiển thị chênh lệch, nên sẽ không ai phát hiện ra. Kế hoạch
gốc có ghi nhận điểm này nhưng xếp vào "ngoài phạm vi" — theo tôi đây không phải một điểm phụ, mà
là đúng phần lõi của tính năng bị hụt trên một loại đơn đang chạy thật.

**Đề xuất:** hoặc cộng phụ phí vào đơn giá dòng hàng (báo giá trả đối tác vẫn giữ nguyên giá gốc,
không đổi), hoặc cảnh báo/chặn khi tạo đơn "thường" từ thực đơn có phụ phí. Chọn phương án nào cũng
được, nhưng để nguyên là phương án duy nhất mất tiền mà không thấy.

> **Bằng chứng:** `orderHelper.ts:566`, `:578-583` · `cartInfoHelper.ts:162-178` ·
> `MealPlanSetup.tsx:387` · đang được "chốt" bằng test `menu-scoped-price.test.ts:184`

#### Quyết định của PO (30/09/2026): thu phụ phí trên đơn "thường"

**Vì sao không thể chỉ cộng phụ phí vào đơn giá dòng hàng.** Dòng hàng của đơn "thường" là nguồn
chung cho cả hai phía: `groupFoodForNormal` lấy `unitPrice` làm `foodPrice`, rồi cùng một danh sách
đó được ghi vào báo giá khách *và* báo giá đối tác (`OrderManagement.slice.ts:1082-1091`). Cộng phí
vào `unitPrice` là trả luôn phần phụ phí cho đối tác. Vì vậy phụ phí phải đi thành một trường
riêng, giống đơn nhóm đang làm (`foodPrice` + `foodExtraFee`).

**Thiết kế đề xuất.** Thêm `unitExtraFee` vào dòng hàng, chốt tại thời điểm chọn món; `unitPrice`
và `price` giữ nguyên là giá gốc.

- Tiền khách trả = `price + unitExtraFee × quantity`. Tiền trả đối tác không đổi.
- Dòng hàng cũ không có trường này ⇒ hiểu là 0 ⇒ **đơn đã chạy không bị tính lại giá**. Đây là lý
  do không đọc phí từ `restaurant.foodList[...].foodExtraFee` lúc tính tiền: cách đó gọn hơn nhưng
  sẽ âm thầm tăng tổng tiền của các đơn "thường" đang chạy, lệch với bản ghi thanh toán đã tạo.
- Công ty chọn 2 món: phụ phí chia đôi theo đúng quy tắc của `adjustFoodListPrice`.

**Hai lỗi liên quan phát hiện khi thiết kế** (phải xử lý cùng, nếu không phần sửa này sẽ nhân rộng
chúng sang đơn "thường"):

- **Mục 15 — huỷ một ngày giao làm mất phụ phí.** `calculatePriceQuotationInfoFromQuotation` chỉ
  cộng `foodPrice × frequency`, không có `foodExtraFee`. Hàm này được dùng để **ghi đè** tổng tiền
  của bản ghi thanh toán khách khi huỷ một ngày giao. Bản ghi được tạo đúng (có phí) lúc bắt đầu
  đơn, rồi bị ghi lại thiếu phí sau lần huỷ đầu tiên. Ảnh hưởng cả đơn nhóm đang chạy hôm nay.
  Cùng hàm này cấp số cho màn hình báo giá của admin và trang chi tiết đơn sau khi chốt báo giá.
- **Mục 16 — đối tác thấy tổng tiền đã cộng phụ phí.** Giỏ hàng ngày giao của đối tác và email
  "đơn hàng thay đổi" tính tổng bằng `calculatePriceQuotationInfoFromOrder`, đi qua `getTotalInfo`
  — nơi đã cộng phụ phí. Tiền thực trả đối tác vẫn đúng (tính từ báo giá, giá gốc), nhưng con số
  hiển thị thì không. *Đọc từ mã nguồn, chưa kiểm tra trên giao diện thật.*

> **Bằng chứng:** `cartInfoHelper.ts:468-477` · `modify-payment-when-cancel-sub-order.service.ts:66` ·
> `SubOrderCart.tsx:74` · `partnerOrderDetailsUpdated.ts:51` · `orderHelper.ts:333`

**Các đợt triển khai** (mỗi đợt một PR, theo thứ tự):

| Đợt | Nội dung | Thay đổi hành vi trên production |
| --- | --- | --- |
| 1a ✅ (30/09/2026) | Các hàm tính tiền phía khách đọc `unitExtraFee` của dòng hàng: `calculateTotalPriceAndDishes`, `calculateSubOrderPrice`, `getFoodDataMap`, `groupFoodForNormal`. Test đủ 3 chế độ VAT. | Không — chưa có dòng hàng nào mang trường này |
| 1b ✅ (02/10/2026) | Sửa mục 15 và 16: báo giá phía khách cộng phụ phí; các luồng đối tác chỉ dùng giá gốc. | Có — đơn nhóm đang chạy: tổng sau khi huỷ ngày giao sẽ đúng, đối tác thôi thấy phụ phí |
| 1c ✅ (04/10/2026) | Ghi `unitExtraFee` ở cả 7 nơi tạo dòng hàng; đổi test `menu-scoped-price.test.ts:184`. | Có — đơn "thường" tạo mới bắt đầu thu phụ phí |
| 1d ✅ (04/10/2026) | Đồng bộ phụ phí sang dòng hàng của đơn nháp khi admin đổi phí; hiển thị đơn giá đã gộp phí ở bảng dòng hàng của khách; cập nhật tài liệu. | Có — đơn nháp "thường" theo kịp phí mới |

> **7 nơi tạo dòng hàng:** `orderHelper.ts:553`, `:590`, `:702` · `SetupOrderDetail.tsx:355`, `:408` ·
> `ResultDetailModal.tsx:246` · `LineItemsTable.tsx:166`
>
> Kết quả 1c: 6 nơi đi qua hàm chung `buildLineItem` (`orderHelper.ts`). `getUpdateLineItemsInDualSelectionOrder`
> (`:590`) không có nơi nào gọi nên để nguyên.

**Ghi chú sau triển khai (04/10/2026):**

- Đợt 1d sửa thêm một lỗi có sẵn: khi admin đổi phụ phí, phần đồng bộ sang đơn nháp ghi **nguyên**
  mức phí cho công ty được chọn 2 món, trong khi giá gốc ở đó đã chia đôi — tức thu phụ phí gấp đôi
  mỗi suất. Nay chia đôi theo đúng quy tắc của `adjustFoodListPrice`.
- Thêm món vào một đơn "thường" **đã chạy** sẽ thu phụ phí cho món mới (lấy từ bản chốt của chính
  đơn đó); các dòng cũ giữ nguyên. Cần PO xác nhận đây là hành vi mong muốn.
- Phụ phí của đơn "thường" giờ cũng nằm trong dữ liệu giao dịch Sharetribe của từng ngày giao (bản
  sao dòng hàng). Không màn hình đối tác nào hiển thị; PO đã xác nhận phụ phí không phải thông tin mật
  (mục 10), nên chấp nhận.

**Còn mở:** đơn nháp "thường" tạo trước đợt 1c sẽ không có phụ phí cho tới khi admin chọn lại món
hoặc đổi phí của thực đơn. Đề xuất chấp nhận, không chạy script bù dữ liệu.

### 2. Phụ phí cũ "sống lại" khi đối tác sửa thực đơn — **Nghiêm trọng**

Khi đối tác gỡ một món khỏi thực đơn, phụ phí của món đó vẫn được giữ lại trong dữ liệu. Nếu sau
này món được thêm trở lại, mức phí cũ tự động có hiệu lực — dù không ai đặt lại.

Đây đúng là loại lỗi mà cả dự án này sinh ra để diệt: "một mức phí xuất hiện ở nơi không ai cài
đặt". Nó chỉ đi vào bằng một cửa khác. Hệ quả thứ hai: cột "Phụ phí" trên màn hình duyệt menu tính
khoảng giá từ cả những món đã không còn trong thực đơn, nên con số admin nhìn thấy có thể sai.

**Đề xuất:** dọn phụ phí của các món không còn trong thực đơn ngay tại thời điểm lưu thực đơn. Sửa
nhỏ, một chỗ.

> **Bằng chứng:** `updateMenu.service.ts:159-208` · `ManagePartnersMenus.page.tsx:247`

**Đã xử lý (05/10/2026):** `updateMenu.service.ts` dọn bảng phụ phí ngay trong lần lưu thực đơn
(`pruneExtraFeesOnMenuSave`). Quy tắc: phụ phí chỉ được giữ cho món **có trong thực đơn trước khi
lưu và vẫn còn sau khi lưu**.

- Món bị gỡ → xoá phụ phí của món đó.
- Món được thêm (kể cả thêm lại) → không mang theo phụ phí cũ; bắt đầu từ "chưa có phụ phí" cho tới
  khi admin nhập. Nhờ vậy cả những phụ phí "mồ côi" đã tồn tại trên production từ trước bản sửa cũng
  không thể sống lại.
- Món chỉ đổi sang ngày khác trong tuần → giữ nguyên phụ phí. Phụ phí `0` được giữ như mọi giá trị
  khác.
- Mọi đường sửa danh sách món của một thực đơn có sẵn (đối tác sửa, gửi duyệt bản nháp) đều đi qua
  `updateMenu`; đường xoá món đã tự dọn phụ phí từ trước (`foodHelpers.ts`).

**Phần hiển thị (05/10/2026):** cột "Phụ phí" ở trang danh sách duyệt menu giờ chỉ tính các món còn
trong thực đơn (`buildExtraFeeLabel`), nên phụ phí mồ côi còn sót trên production (chưa được dọn vì
thực đơn chưa lưu lại) không còn làm sai khoảng giá hiển thị.

---

## B. Vòng đời & vận hành

### 3. Duyệt xong là khoá — không có đường sửa sai

Quy tắc "duyệt thực đơn = chốt phụ phí" là đúng về nguyên tắc, nhưng hiện không có bất kỳ lối thoát
nào. Gõ nhầm 150.000 thay vì 15.000, phát hiện sau khi duyệt thì trong hệ thống **không có cách nào
sửa**: API từ chối, file import cũng chỉ nhận thực đơn đang chờ duyệt.

Đường duy nhất còn lại là từ chối thực đơn và nhờ đối tác gửi lại — kéo cả bên thứ ba vào một lỗi
nội bộ của PITO. Kế hoạch gốc không nêu kịch bản khắc phục này.

~~**Đề xuất:** cho admin quyền sửa sau duyệt có ghi vết (ai sửa, lúc nào, từ giá trị nào), và chỉ áp
dụng cho đơn hàng tạo sau đó — đơn đã chạy vẫn giữ giá đã chốt như hiện tại.~~

**Quyết định của PO (30/09/2026): đóng, không xử lý.** Khoá vĩnh viễn sau duyệt là quy tắc chủ
đích. Sai số tiền thì từ chối thực đơn và nhờ đối tác gửi lại.

Hệ quả cần lưu ý: vì không còn đường sửa sau duyệt, hai chốt chặn *trước* khi duyệt (mục 5 — cảnh
báo khi duyệt thực đơn chưa nhập phí, và mục 6 — mất số đang nhập dở) là thứ duy nhất ngăn một thực
đơn bị khoá ở mức phí sai. Nên làm ngay sau đợt 1.

> **Bằng chứng:** `updateMenuExtraFees.service.ts:186-187` (tính năng import phụ phí đã bị gỡ ngày
> 27/09/2026, nên không còn đường ghi nào khác)

### 4. Đối tác gửi duyệt lại ⇒ đơn nháp của khách bị đổi giá âm thầm

Một thực đơn đã duyệt và đang được dùng vẫn có thể được đối tác gửi duyệt lại, và khi đó phụ phí mở
khoá trở lại. Admin đổi phí → hệ thống ghi đè giá lên mọi đơn hàng đang ở trạng thái nháp *và* chờ
duyệt.

"Chờ duyệt" nghĩa là khách hàng đã xem và đã bấm gửi với một con số tổng cụ thể. Đổi giá sau đó mà
không báo là chuyện khách sẽ phát hiện ở khâu thanh toán. Kế hoạch gốc gộp chung "đơn nháp" và "chờ
duyệt" là một nhóm an toàn để ghi đè — tôi cho rằng không phải.

**Đề xuất:** chỉ đồng bộ lại giá cho đơn khách chưa gửi; đơn đã gửi chờ duyệt thì đánh dấu để admin
xử lý thủ công, hoặc thông báo cho khách.

> **Bằng chứng:** `publish-draft.api.ts:65-76` · `updateMenuExtraFees.service.ts:72-170`

### 5. Duyệt thực đơn chưa nhập phụ phí: không cảnh báo

Không có gì kiểm tra rằng phụ phí đã được nhập trước khi bấm Duyệt. Duyệt nhầm một thực đơn trống
phí là khoá nó ở mức 0 cho toàn bộ kỳ sử dụng.

**Đề xuất:** hộp xác nhận khi duyệt thực đơn chưa có phụ phí hoặc mới có một phần. Rất rẻ để làm, và
với quy tắc khoá hiện tại thì đây là chốt chặn duy nhất.

> **Bằng chứng:** thiếu kiểm tra ở luồng `approveMenu` — `ManagePartnersMenus.slice.ts:138`

**Quyết định của PO (04/10/2026):** trước khi duyệt luôn hiện hộp xác nhận "Lưu ý khi đã duyệt thì
không điều chỉnh được phụ phí" (với mọi thực đơn, không phụ thuộc đã nhập phí hay chưa).
Đã làm ở `ManagePartnerMenu.page.tsx`.

### 6. Số đang nhập dở bị mất khi rời trang — mà nút Duyệt nằm ở trang khác

Phần phụ phí nhập trong bảng xổ chỉ nằm trong bộ nhớ tạm của trang danh sách. Quy trình tự nhiên của
admin là: gõ phụ phí → mở trang chi tiết để xem lại → bấm Duyệt. Đúng thao tác đó làm mất toàn bộ số
vừa gõ, và thực đơn bị khoá ở mức 0.

**Đề xuất:** cảnh báo khi rời trang lúc còn thay đổi chưa lưu, hoặc giữ lại bản nháp theo từng thực
đơn.

> **Bằng chứng:** quyết định "xoá nháp khi đổi trang" ở Giai đoạn 4 · nút Duyệt nằm ở trang chi tiết

**Quyết định của PO (05/10/2026): đóng, giữ nguyên nghiệp vụ hiện tại.** Không xử lý. Hộp xác nhận trước khi duyệt (mục 5) vẫn nhắc admin rằng
duyệt xong là khoá phụ phí.

---

## C. Độ ổn định khi chạy thật

Những điểm này ít lộ ra trên môi trường thử, nhưng sẽ xuất hiện khi một thực đơn được dùng suốt một
mùa, hoặc khi import một file lớn.

### 7. Đồng bộ giá chỉ chạy trên 100 đơn đầu tiên

Khi đổi phụ phí, hệ thống tìm các đơn liên quan để cập nhật giá, nhưng truy vấn không phân trang —
chỉ 100 bản ghi đầu được xử lý. Các đơn còn lại giữ giá cũ, không báo lỗi.

**Đề xuất:** dùng đúng cơ chế lấy toàn bộ mà phần import đã dùng (`queryAllListings`), và lọc theo
trạng thái đơn ngay từ truy vấn.

> **Bằng chứng:** `updateMenuExtraFees.service.ts:79-86` · so với `queryAllListings` trong
> `importMenuExtraFees.service.ts:203-209`

**Đã xử lý (04/10/2026):** truy vấn kế hoạch giờ đọc đủ mọi trang (`queryAllPages`), có test cho
trường hợp đơn nháp nằm ở trang 2. Việc lọc theo trạng thái vẫn làm sau khi lấy đơn hàng, vì trạng
thái nằm trên đơn hàng chứ không nằm trên kế hoạch — không lọc được ngay trong truy vấn.

### 8. Áp hàng loạt lỗi giữa chừng: không biết thực đơn nào đã áp

Áp phụ phí cho nhiều thực đơn cùng lúc chạy song song. Nếu một thực đơn lỗi (ví dụ vừa được duyệt ở
tab khác), màn hình báo một lỗi chung trong khi các thực đơn khác đã ghi xong. Admin không có cách
nào biết cái nào đã áp, cái nào chưa, ngoài việc mở từng cái ra xem.

Cùng dạng vấn đề: việc ghi phụ phí và việc đồng bộ giá sang đơn hàng không đi cùng nhau — phí ghi
xong rồi, đồng bộ lỗi thì hệ thống vẫn báo thành công. Ngoài ra, import một file lớn có thể bắn hàng
trăm lệnh gọi cùng lúc sang Sharetribe và chạm giới hạn tần suất.

**Đề xuất:** báo kết quả theo từng thực đơn (thành công / lỗi + lý do), giới hạn số lệnh chạy song
song.

> **Bằng chứng:** `ManagePartnersMenus.slice.ts:228-234` · `importMenuExtraFees.service.ts:220-224` ·
> `updateMenuExtraFees.service.ts:160-164`

**Quyết định của PO (05/10/2026): đóng, giữ nguyên nghiệp vụ hiện tại.** Không xử lý. (Phần import phụ phí nêu trong mục này đã bị gỡ ngày 27/09/2026.)

### 9. Dữ liệu nhập sai vẫn báo "đã lưu"

Số âm, ký tự lạ, hay món không thuộc thực đơn đều bị bỏ qua lặng lẽ thay vì báo lỗi — admin thấy
thông báo lưu thành công trong khi không có gì thay đổi. Tương tự, tham số `mode` không được kiểm
tra: bất kỳ giá trị nào khác `'merge'` đều bị hiểu là ghi đè toàn bộ.

**Đề xuất:** trả lỗi rõ ràng theo từng dòng, như phần import đang làm rất tốt.

> **Bằng chứng:** `updateMenuExtraFees.service.ts:41-63` · `extra-fee.api.ts:15`

---

## D. Quyết định sản phẩm cần xác nhận

### 10. Phụ phí là dữ liệu công khai của thực đơn

Mức phụ phí từng món được lưu ở phần dữ liệu công khai của thực đơn, và được gửi thẳng xuống trình
duyệt của khách hàng khi họ chọn nhà hàng. Ai mở công cụ dành cho nhà phát triển đều đọc được —
nghĩa là biết luôn giá gốc đối tác và phần chênh của PITO. Đối tác cũng đọc được phần này trên thực
đơn của chính họ.

Giao diện đã ẩn đúng cách (đối tác chỉ thấy giá gốc, khách chỉ thấy giá đã cộng), nhưng dữ liệu thô
thì không. Kế hoạch gốc chưa từng đặt câu hỏi phụ phí có phải thông tin mật hay không.

~~**Đề xuất:** nếu PO xác nhận đây là thông tin mật, chỉ gửi xuống giao diện *giá đã gộp*, không gửi
hai thành phần riêng.~~

**Quyết định của PO (04/10/2026): đóng, không xử lý.** Phụ phí là dữ liệu công khai của thực đơn,
không phải thông tin mật. Giao diện vẫn giữ cách hiển thị hiện tại (đối tác thấy giá gốc, khách thấy
giá đã cộng phụ phí); dữ liệu thô không cần ẩn.

> **Bằng chứng:** `fetch-food-from-menu.api.ts` · `SelectRestaurantPage.slice.ts`

### 11. Áp hàng loạt một mức phí xung đột với cơ chế gợi ý nhà hàng

*Viết lại chi tiết ngày 05/10/2026.*

#### Vấn đề

**1. Cơ chế gợi ý chỉ lấy món có giá cuối bằng đúng gói.** Khi tạo đơn, hệ thống chỉ giữ những món
có `giá gốc + phụ phí` **bằng đúng** ngân sách mỗi người (`packagePerMember`) của công ty — rẻ hơn
hay đắt hơn gói đều bị loại. Quy tắc này nằm ở 3 chỗ:

| Chỗ | Hành vi |
| --- | --- |
| Gợi ý nhà hàng tự động — `prepareData.ts:316` (`filterMenusHavePackagePerMember`) | Thực đơn chỉ được xét nếu có **ít nhất 1 món** khớp đúng gói |
| Danh sách món của nhà hàng được gợi ý — `prepareData.ts:138` (`prepareMenuFoodList`) | Chỉ giữ những món khớp đúng gói |
| Admin xem món theo nhà hàng khi tạo đơn — `get-restaurant-foods.api.ts:128` → `searchRestaurantHelper.ts:93-96` | Món không khớp đúng gói bị ẩn |

**2. Nút "Thêm phụ phí" áp cùng một mức cho mọi món.** Nút này ghi một số tiền cho **tất cả** món
của các thực đơn được chọn (`ManagePartnersMenus.slice.ts:201-205`, `buildFlatExtraFeeMap`).

**3. Khi các món trong thực đơn có giá gốc khác nhau, hai thứ trên va nhau.** Ví dụ công ty có gói
50.000đ/người, admin áp hàng loạt phụ phí 10.000đ:

| Món | Giá gốc | + Phụ phí | Giá cuối | Khớp gói 50.000? |
| --- | --- | --- | --- | --- |
| Cơm gà | 40.000 | 10.000 | 50.000 | ✅ được gợi ý |
| Bún bò | 45.000 | 10.000 | 55.000 | ❌ bị loại |
| Phở | 35.000 | 10.000 | 45.000 | ❌ bị loại |

Muốn cả 3 món cùng khớp gói 50.000 thì phụ phí phải là 10.000 / 5.000 / 15.000 — mỗi món một mức.
Nếu không món nào rơi đúng vào gói, **cả thực đơn biến mất khỏi gợi ý** mà không có cảnh báo nào.
Chỉ những món cùng giá gốc mới cùng khớp một gói khi áp chung một mức phí.

**4. Giới hạn sẵn có (không do nút áp hàng loạt):** mỗi món chỉ có một mức phụ phí trong một thực
đơn, nên chỉ khớp được **một** mức gói. Cơm gà 40.000 + 10.000 khớp gói 50.000; công ty có gói
60.000 sẽ không được gợi ý món này. Quy tắc "khớp đúng gói" có từ trước khi có phụ phí — phụ phí chỉ
thêm một con số phải chỉnh cho khớp.

**Mức độ thực tế phụ thuộc cách đối tác làm thực đơn:**

- Các món trong một thực đơn **cùng giá gốc** (kiểu "thực đơn suất 40k") → áp một mức phí cho cả
  thực đơn là đúng, mục này **không cần sửa**.
- Một thực đơn có **nhiều mức giá gốc** → áp hàng loạt làm rơi món khỏi gợi ý. Đã giảm nhẹ một phần
  nhờ tính năng tick chọn từng món trong bảng phụ phí: admin tick nhóm món cùng giá gốc rồi áp một
  mức cho nhóm đó.

**Cần PO xác nhận:** (1) các món trong một thực đơn thường cùng giá gốc hay nhiều mức giá?
(2) PITO có danh sách mức gói chuẩn (ví dụ 45k / 50k / 60k) không?

#### Cách A — cảnh báo trong bảng nhập phụ phí (đề xuất, nhẹ)

- Trong bảng nhập phụ phí từng món, thêm cột **"Giá cuối"** = giá gốc + phụ phí.
- Nếu PITO có danh sách mức gói chuẩn: đánh dấu món có giá cuối **không khớp mức gói nào** ("món
  này sẽ không được gợi ý"), để admin chỉnh trước khi duyệt — vì duyệt xong là khoá phí (mục 3).
- Chỉ đổi giao diện admin; không đổi cách tính tiền, không đổi hành vi gợi ý.
- Phụ thuộc: cần danh sách mức gói chuẩn để biết "khớp" với cái gì. Không có danh sách thì chỉ hiện
  được cột "Giá cuối", không cảnh báo được.

#### Cách B — nới quy tắc gợi ý thành "không vượt gói" (nặng)

- Đổi 3 chỗ ở bảng trên từ `giá cuối === gói` thành `giá cuối <= gói`.
- Giải quyết tận gốc: món rẻ hơn gói vẫn được gợi ý, một món phục vụ được nhiều mức gói.
- Nhưng đổi hành vi gợi ý của **mọi** đơn hàng, kể cả đơn không dính phụ phí: nhà hàng/món trước đây
  bị loại sẽ xuất hiện, thứ tự gợi ý thay đổi, và công ty có thể được gợi ý món rẻ hơn hẳn gói (PITO
  thu ít hơn ngân sách khách sẵn sàng trả).
- Cần PO quyết riêng như một thay đổi nghiệp vụ, kèm thống nhất cách sắp xếp ưu tiên (ví dụ: món sát
  gói nhất lên trước — đã có sẵn `sortMenusByPackagePerMemberProximity` cho thực đơn).

> **Bằng chứng:** `prepareData.ts:138`, `:316` · `get-restaurant-foods.api.ts:128` ·
> `searchRestaurantHelper.ts:93-96` · `ManagePartnersMenus.slice.ts:201-205`

### 12. Bộ lọc ngân sách vẫn lọc theo giá gốc

Bộ lọc "thực đơn trong tầm ngân sách" chạy trên giá gốc, chưa cộng phụ phí, và không được tính lại
khi phụ phí thay đổi. Một thực đơn có thể lọt qua bộ lọc rồi hiện ra với **không món nào chọn
được**, vì tất cả đã vượt ngân sách sau khi cộng phí.

**Đề xuất:** cập nhật lại giá thấp nhất của thực đơn (đã gộp phí) mỗi khi lưu phụ phí, hoặc xử lý rõ
trạng thái "không có món phù hợp".

> **Bằng chứng:** `listingSearchQuery.ts:98`, `:177`, `:316` · `searchRestaurantHelper.ts:128`

**Quyết định của PO (05/10/2026): lọc theo giá mới (đã gộp phụ phí).** Đã xử lý:

- **Đổi ý nghĩa `<ngày>MinFoodPrice`** thành *giá thấp nhất khách trả trong ngày, đã gộp phụ phí*
  (`getMinBillablePrice`). Giữ nguyên tên trường nên không cần đăng ký thêm search schema trên
  Sharetribe. Mọi nơi dùng trường này đều so với gói — vốn đã gộp phụ phí; không màn hình nào hiển thị
  nó cho đối tác.
- **12a** — tính đúng khi đối tác lưu thực đơn (`updateMenu`, dùng bảng phụ phí đã dọn ở mục 2) và khi
  admin đổi phụ phí (`updateMenuExtraFees`, lấy giá gốc từ listing món; ngày không đọc được món thì
  giữ nguyên chứ không đặt về 0).
- **12b** — giữ đúng khi đối tác đổi giá món hoặc xoá món (3 đường trong `foodHelpers.ts`).
- Thực đơn không có phụ phí (tạo mới, nhân bản) giữ nguyên như cũ.
- **12c** — script chạy bù cho thực đơn đang có phụ phí:
  `node scripts/backfill-menu-min-food-price.js --env=<file env>` (mặc định chạy thử, chỉ in thay đổi);
  thêm `--apply` để ghi. **Cần chạy trên production.** Trước khi chạy, các thực đơn đó vẫn lọc theo
  giá gốc như trước — không tệ hơn hiện tại.

### 13 & 14. Hai giới hạn nhỏ cần xác nhận

**Chia đôi phụ phí không làm tròn.** Với công ty được chọn 2 món, phụ phí bị chia đôi mà không làm
tròn — mức phí lẻ sẽ tạo ra số tiền lẻ đến từng đồng trong tổng. Nên giới hạn phụ phí theo bội số
(ví dụ 1.000đ) ngay khi nhập.

**Thực đơn xoay vòng.** Mỗi món chỉ có đúng một mức phí cho cả thực đơn, dùng chung cho mọi thứ
trong tuần và mọi vòng lặp. Đây là quyết định đã ghi trong kế hoạch — chỉ cần PO xác nhận không có
nghiệp vụ nào cần cùng một món hai mức giá trong cùng thực đơn.

> **Bằng chứng:** `orderHelper.ts:820` · `updateMenuExtraFees.service.ts:41-63`

**Quyết định của PO (05/10/2026): đóng cả hai, giữ nguyên nghiệp vụ hiện tại.** Không giới hạn bội
số khi nhập phụ phí; mỗi món một mức phí cho cả thực đơn là đúng nghiệp vụ.

---

## Những gì kế hoạch đã làm đúng

Để bảng trên không bị đọc thành "mọi thứ đều hỏng".

- Chuyển phụ phí từ **món ăn** sang **cặp (thực đơn, món)** — đã xử lý dứt điểm lỗi gốc: một món
  dùng chung nhiều thực đơn bị đổi giá dây chuyền.
- Đơn đã chạy không bao giờ bị tính lại giá — con số chốt tại thời điểm đặt là con số tính tiền.
- Báo giá trả đối tác tuyệt đối không thấy phụ phí.
- Mức phí **0** được xử lý đúng là "không thu phụ phí", không bị hiểu nhầm thành "chưa nhập".
- So sánh với gói ngân sách đã dùng giá đã gộp phí ở hầu hết các màn hình.
- Bộ test bảo vệ khá dày cho phần lưu trữ và đồng bộ.

---

## Đề xuất thứ tự xử lý

| Đợt | Nội dung | Lý do |
| --- | --- | --- |
| 1 | ✅ Mục 1, 15, 16 (các đợt 1a–1d ở mục 1) và mục 2 — đơn "thường" không thu phí, mất phí khi huỷ ngày giao, và phụ phí sống lại | Đang gây sai tiền, không có dấu hiệu phát hiện |
| 2 | Mục 5 ✅ — chốt chặn khi duyệt (mục 3, 6 đã đóng) | Không còn đường sửa sau duyệt, nên đây là chốt chặn duy nhất |
| 3 | Mục 4, 9 (mục 7 ✅, mục 8 đã đóng) — độ chính xác và độ ổn định khi dữ liệu lớn dần | Xuất hiện khi thực đơn được dùng qua nhiều kỳ |
| 4 | Mục 11 — chờ PO (mục 10, 13, 14 đã đóng; mục 12 ✅) | Cần PO xác nhận trước khi ước lượng công việc |

---

*Mọi số dòng trong tài liệu là để đội kỹ thuật tra cứu nhanh, không cần thiết cho phần quyết định
của PO.*
