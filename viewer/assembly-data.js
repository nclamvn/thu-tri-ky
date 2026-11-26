import {physical} from './simulation-data.js?v=a0cc1c2d1068';

// Simulation coordinates in millimetres, Y up, +Z toward the user.
// Each position refers to the centre of a module, except full shell meshes whose origin is at the base.
export const envelope = {width:75, height:124, depth:44};
export const carrierFit={origin:[0,59,-8.65],frameDepth:1,frameBevel:.15,screwDiameter:2};
const pcbRear=physical.pcb.center[2]-physical.pcb.size[2]/2;
export const boardMounts=physical.pcb.mountingHole.centers.map(([x,y])=>
  [x+physical.pcb.center[0]-carrierFit.origin[0],y+physical.pcb.center[1]-carrierFit.origin[1],pcbRear-carrierFit.origin[2]]);
export const modules = [
  {id:'face', name:'Mặt trước & kính', group:'Ngoại thất', origin:[0,0,0], spread:[-137,4,64], compact:[-67,33,44], release:0,
    mark:[0,85,24],
    purpose:'Kính khói phủ vùng hiển thị trên mặt trước liền. Lỗ thoát âm được đặt ở lưng.',
    mount:'Đặt ở phía trước cụm màn hình và loa.', link:[]},
  {id:'display', name:'Màn hình Rev1B', group:'Hiển thị', origin:physical.display.center, spread:[-74,25,35], compact:[0,2,13], release:.15,
    mark:[0,25,4],
    purpose:'Panel IPS 2,8 inch đặt dọc. Thân 50 × 69,2 mm và vùng ảnh 43,2 × 57,6 mm.',
    mount:'Sau kính khói. Cáp mềm 40 tiếp điểm gập về bo xử lý.', link:['logic']},
  {id:'mic', name:'Bo micro', group:'Âm thanh', origin:[0,111,7], spread:[-64,23,22], compact:[0,24,18], release:.19,
    mark:[0,0,2],
    purpose:'Hai micro PDM Infineon IM69D128S. Khoảng cách tâm dự kiến 30 mm.',
    mount:'Đặt phía trên màn. Hai gioăng âm học độc lập áp vào cửa thu.', link:['logic']},
  {id:'speaker', name:'Loa và buồng âm', group:'Âm thanh', origin:physical.speaker.centre, spread:[-66,-23,33], compact:[-67,-23,13], release:.14,
    mark:[0,0,5],
    purpose:'Loa PUI AS02808MR-R, đường kính 28 mm, với buồng sau có thể đổi để thử.',
    mount:'Hướng ra phía trước, sau vùng thoát âm ở nửa dưới.', link:['logic']},
  {id:'logic', name:'Bo xử lý', group:'Điện tử', origin:physical.pcb.center, spread:[0,23,11], compact:[0,-45,16], release:.20,
    mark:[0,2,4],
    purpose:'PCB với mô-đun ESP32-S3 và giao tiếp màn, micro, loa. Mỗi lớp đồng có thể xem riêng trong chi tiết bo.',
    mount:'Nằm giữa thân, trên khung đỡ và ở phía trước pin.', link:['display','mic','speaker','io']},
  {id:'battery', name:'Pin', group:'Nguồn', origin:[0,54,-14.0], spread:[70,44,-19], compact:[67,-56,4], release:.17,
    mark:[0,0,5],
    purpose:'Pin túi 1S với PCM và cảm biến nhiệt. Khoang dự kiến 51 × 63 × 9 mm.',
    mount:'Đặt sau bo xử lý, trong phần bầu của lưng vỏ.', link:['io']},
  {id:'io', name:'Bo nguồn & USB-C', group:'Nguồn', origin:[0,15.6,-12.8], spread:[0,-17.6,35], compact:[-67,-57,27], release:.20,
    mark:[0,-4,-4],
    purpose:'Cổng USB-C và cụm quản lý nguồn dự kiến nối nguồn ngoài với pin và bo xử lý.',
    mount:'Đặt dưới bo xử lý, cạnh khe cổng ở chân thiết bị.', link:['logic','battery']},
  {id:'carrier', name:'Khung đỡ', group:'Cơ khí', origin:carrierFit.origin, spread:[70,-36,-22], compact:[67,-131,-7], release:.27,
    mark:[0,0,3],
    purpose:'Giữ vị trí bo xử lý và tạo điểm bắt cho các cụm bên trong.',
    mount:'Nằm trong vỏ, giữa bo xử lý và pin.', link:[]},
  {id:'housing', name:'Vỏ sau', group:'Ngoại thất', origin:[0,0,0], spread:[143,3,-45], compact:[67,31,-33], release:.04,
    mark:[14,82,-15],
    purpose:'Vỏ bầu bao quanh cụm điện tử, với 49 lỗ loa xuyên vỏ bố trí thấp ở lưng.',
    mount:'Ghép vào mặt trước và tì lên đế.', link:[]},
  {id:'base', name:'Đế', group:'Cơ khí', origin:[0,0,0], spread:[146,-26,-32], compact:[0,-60,-4], release:.09,
    mark:[0,3,10],
    purpose:'Tạo mặt tựa phẳng để thiết bị đứng vững trên bàn.',
    mount:'Nằm dưới vỏ sau và mặt trước.', link:[]},
  {id:'harness', name:'Cáp & dây', group:'Liên kết', origin:[0,22,-6], spread:[-32,16,20], compact:[-65,-103,17], release:.24,
    mark:[0,0,3],
    purpose:'Cáp mềm và các bó dây đại diện cho liên kết giữa màn hình, bo micro, loa và các bo.',
    mount:'Đi trong thân máy. Hướng tuyến chi tiết đang ở mức bố trí.', link:[]},
];
export const byId = Object.fromEntries(modules.map(part=>[part.id,part]));

// Presentation angles reached only when exploded. In the assembled pose
// each module retains its mounting orientation.
export const inspectionAngles = {
  face:[.02,.12,-.025], display:[-.11,-.13,.018], mic:[.20,-.14,.038],
  speaker:[.09,-.18,-.028], logic:[.06,-.22,-.035], battery:[.08,-.18,.025],
  io:[-.13,2.85,-.055], carrier:[.03,-.17,.02], housing:[.01,-.12,.013],
  base:[.13,-.10,.045], harness:[.22,-.10,.04],
};

export const logicSockets = {
  'logic-j1':[0,-18,2.25],
  'logic-j2':[15,27,2.25],
  'logic-j3':[-14,-31,2.25],
  'logic-j4':[13,-31,2.25],
};
export const connections = [
  {from:'mic', to:'logic', a:[0,-.9,1.45], b:logicSockets['logic-j2'], label:'Tín hiệu micro', color:'#598895'},
  {from:'display',to:'logic',a:[0,...physical.display.flexPath.at(-1)],b:logicSockets['logic-j1'],label:'Dữ liệu màn hình',color:'#598895'},
  {from:'logic',to:'speaker',a:logicSockets['logic-j3'],b:[9,-8,-4],label:'Âm thanh ra loa',color:'#598895'},
  {from:'battery',to:'io',a:[-8,-33,1.2],b:[14,5,1],label:'Nguồn pin',color:'#bb8b42'},
  {from:'io',to:'logic',a:[-13,5,1],b:logicSockets['logic-j4'],label:'Nguồn và kết nối',color:'#bb8b42'},
];
