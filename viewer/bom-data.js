import {modules} from './assembly-data.js';
import {layers,physical} from './simulation-data.js';

// A row describes a selectable scene group. Counts apply to this concept only.
const inventory = {
  face: [
    ['face-glass','GL01','Kính khói',1,'Tấm','Phủ vùng hiển thị mắt H.'],
    ['face-bezel','BZ01','Viền mặt kính',1,'Chi tiết','Ôm mép kính và tạo đường chuyển sang mặt trước.'],
    ['face-cover','FC01','Vỏ mặt trước',1,'Chi tiết','Bề mặt liền theo video giới thiệu. Hai nửa vỏ nối tiếp cùng đường cong.'],
  ],
  display: [
    ['display-panel','LCD1','Panel IPS Rev1B',1,'Cụm',physical.display.part+' · 240 × 320, đặt dọc.'],
    ['display-frame','DF01','Khung màn hình',1,'Chi tiết','Định vị panel ngay sau mặt kính.'],
    ['display-flex','FPC01','Đuôi cáp mềm 40 chân',1,'Chi tiết','Bước chân 0,5 mm. Đường gập thể hiện bố trí thử.'],
  ],
  mic: [
    ['mic-pcb','MB01','Nền bo micro',1,'Bo','Hai lỗ thu đáy Ø0,6 mm theo khuyến nghị hãng. Tâm lỗ và gioăng âm học cần đối chiếu footprint khi thiết kế PCB.'],
    ['mic-capsules','M1/M2','Micro số Infineon',2,'Linh kiện',physical.mic.part+' · PDM, cửa âm đáy, khoảng cách hai tâm 30 mm.'],
    ['mic-filter','MF01','Dãy tiếp điểm bo micro',1,'Dãy','Nhóm năm tiếp điểm ở giữa bo.'],
  ],
  speaker: [
    ['speaker-basket','SPK1','Vành loa tròn PUI',1,'Chi tiết',physical.speaker.part+' · Ø28 × 5,2 mm, 8 Ω.'],
    ['speaker-cone','SP02','Màng côn và chụp bụi',1,'Cụm','Phần màng chuyển động của loa.'],
    ['speaker-ring','SP03','Gân và vành loa',1,'Cụm','Vòng đàn hồi và vành giữ mép màng.'],
    ['speaker-magnet','SP04','Cụm nam châm loa',1,'Cụm','Cụm kim loại phía sau, thể hiện trong tách lớp.'],
    ['speaker-chamber','ACOUSTIC1','Buồng sau của loa',1,'Chi tiết','Kiểu A theo đồ gá R1. Thể tích 5,63 cm³ trước khi trừ không gian chiếm chỗ.'],
  ],
  logic: [
    ['logic-pcb','MAIN-PCB','Mô hình bo chính',1,'Bo','Bo 48 × 76 mm. Vị trí các linh kiện lớn đang được đối chiếu với kích thước hãng. Hình đồng và via là minh họa, chưa có layout ECAD.'],
    ...layers.map(([key,ref,name])=>[key,ref,name,1,'Lớp','Phân lớp chức năng dự kiến. Hình đồng và via là minh họa, chưa có netlist.']),
    ['logic-processor','U1','Mô-đun ESP32-S3',1,'Linh kiện',physical.pcb.module+' · 18 × 25,5 × 3,1 mm. Flash và PSRAM tích hợp trong mô-đun.'],
    ['logic-interface','U12','IC chuyển mức SPI',1,'Linh kiện','SN74AXC8T245RHLR chuyển mức giao tiếp LCD.'],
    ['logic-voice','U3','Ampli I²S',1,'Linh kiện','MAX98357AETE+T đưa PCM ra loa.'],
    ['logic-memory','U2','IC dòng đèn nền',1,'Linh kiện','TLC5916IPWR điều khiển bốn nhánh đèn nền thử.'],
    ['logic-clock','U11','Ổn áp 1,8 V',1,'Linh kiện','TLV75518PDBVR cấp cho VDDI của màn.'],
    ['logic-passives','R/C','Vị trí SMD minh họa',null,'Vị trí','Các vị trí này chưa có giá trị linh kiện, mã mua hoặc liên kết net.'],
    ['logic-j1','J1','Đầu nối FFC 40 chân',1,'Đầu nối','Molex 0541324062 · 25,5 × 5 × 2 mm khi đóng, 40 chân bước 0,5 mm, tiếp xúc dưới. Cần kiểm FPC và thao tác chốt.'],
    ['logic-j2','J-MIC','Đầu nối micro',1,'Đầu nối','Vị trí dự kiến. Chưa khóa mã đầu nối và đầu cáp tương ứng.'],
    ['logic-j3','J3','Đầu nối loa',1,'Đầu nối','Vị trí dự kiến. Chưa khóa mã đầu nối và đầu cáp tương ứng.'],
    ['logic-j4','J4','Đầu nối nguồn',1,'Đầu nối','Vị trí dự kiến. Chưa khóa mã đầu nối, đầu cáp và định mức dòng.'],
    ['logic-test','TP1–6','Điểm kiểm tra',6,'Điểm','Các pad kiểm tra được thể hiện nổi trên mặt bo.'],
  ],
  battery: [
    ['battery-cell','BT1','Pack pin 1S',1,'Cụm','Dùng kích thước pack tham chiếu Jauch 246519. Biến thể bảo vệ và NTC đang là yêu cầu thiết kế.'],
    ['battery-guard','BP01','Bo bảo vệ pin',1,'Bo','Cụm bo nhỏ phía đầu cell, chức năng bảo vệ dự kiến.'],
    ['battery-tabs','BAT-1–3','Ba đầu dây pin',3,'Chi tiết','Hai dây nguồn và một đầu đo nhiệt cho pack thiết kế.'],
  ],
  io: [
    ['io-pcb','PCB02','Nền bo nguồn',1,'Bo','Đỡ cổng ngoài và các linh kiện nguồn.'],
    ['io-port','J2','Cổng USB-C',1,'Đầu nối','Mã dự kiến GCT USB4105-GF-A-120. Hình 3D biểu diễn miệng cổng. Kiểu gá và mặt phẳng PCB cần đồng bộ để dùng footprint hãng.'],
    ['io-power','U6/U7','IC USB-C và sạc',2,'Linh kiện','TUSB320LAIRWBR nhận mức CC và BQ25895RTWR sạc pin 1S.'],
  ],
  carrier: [
    ['carrier-frame','FR01','Khung chịu lực',1,'Chi tiết','Hai dầm dọc và các thanh ngang của khung trong.'],
    ['carrier-posts','ST1–4','Trụ đỡ bo',4,'Chi tiết','Các trụ phía trước khung để đặt bo.'],
    ['carrier-screws','SC1–4','Vít bắt bo',4,'Chi tiết','Thân vít Ø2 mm trong mô hình. Chờ chốt ren, vật liệu trụ, độ ăn ren và mô-men siết.'],
  ],
  housing: [
    ['housing-body','CV01','Thân vỏ sau',1,'Chi tiết','Thể hiện mặt ngoài, mặt trong và 49 lỗ loa xuyên lưng. Đường dẫn âm chờ kiểm trên mẫu.'],
    ['housing-gasket','GK01','Gioăng chu vi',1,'Chi tiết','Dải đệm chạy dọc theo mép vỏ.'],
    ['housing-inserts','IN1–6','Gối bắt trong vỏ',6,'Chi tiết','Các điểm giữ khung trong vỏ sau.'],
    ['housing-switch','SW01','Nút bên hông',1,'Chi tiết','Mặt nút kim loại nằm trên sườn vỏ.'],
  ],
  base: [
    ['base-body','BS01','Đế và viền champagne',1,'Chi tiết','Viền mảnh ôm theo đường đáy của hai nửa vỏ.'],
    ['base-feet','FT1–4','Chân đệm đế',4,'Chi tiết','Các đệm ở mặt tiếp xúc với bàn.'],
  ],
  harness: [
    ['cable-panel','CB01','Cáp mềm màn hình',1,'Cáp','Đường nối dự kiến giữa màn hình và bo xử lý.'],
    ['cable-mic','CB02','Bó dây micro',1,'Cáp','Đường nối dự kiến từ bo micro về bo xử lý.'],
    ['cable-speaker','CB03','Bó dây loa',1,'Cáp','Đường nối dự kiến từ bo xử lý tới loa.'],
    ['cable-battery','CB04','Bó dây pin',1,'Cáp','Đường nối dự kiến từ cell pin tới bo nguồn.'],
    ['cable-power','CB05','Bó dây cấp nguồn',1,'Cáp','Đường nối dự kiến giữa bo nguồn và bo xử lý.'],
  ],
};

export const logicPassives = [
  [-18,7],[-18,3],[-18,-1],[-12,7],[-10,3],[-7,7],[-3,6],[1,8],
  [7,14],[7,10],[12,14],[17,14],[17,9],[17,5],[19,1],[5,1],
  [-19,-7],[-19,-11],[-15,-14],[-10,-10],[-8,-6],[-4,-7],[0,-6],[4,-6],
  [18,-9],[18,-14],[8,-10],[-18,-20],[-16,-25],[-4,-25],[6,-26],[17,-24],
].map(([x,y],i)=>({x,y,kind:i%3===1?'resistor':'capacitor',vertical:i%4<2}));

export const entries = modules.flatMap(({id})=>inventory[id].map(([key,ref,name,qty,unit,purpose])=>({
  key, ref, name, qty:qty ?? logicPassives.length, unit, purpose, module:id,
})));
export const bomByKey = Object.fromEntries(entries.map(item=>[item.key,item]));
export const bomByModule = Object.fromEntries(modules.map(({id})=>[id,entries.filter(item=>item.module===id)]));

export function normalizeSearch(text){
  return text.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/đ/g,'d').trim();
}
