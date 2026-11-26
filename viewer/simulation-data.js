// Millimetres. These are the EVT0 design inputs used by the interactive model.
export const physical = {
  display:{part:'NHD-2.8-240320AF-CSXP-F_Rev1B', body:[50,69.2,2.39], envelope:[50.2,69.4,3.6],
    active:[43.2,57.6], fpc:40, bodyToActive:2.75, center:[0,66.6,14.0],
    connector:{body:[25.5,5,2],pitch:.5,openDepth:6.55,insertionDepth:3.6,tailWidth:20.5},
    flexPath:[[-34.1,.05],[-35.8,-.4],[-35.8,-1.8],[-29.4,-1.93],[-25.9,-4.35],[-23.8,-11.2],[-21.6,-18.25]]},
  speaker:{part:'AS02808MR-R', diameter:28, depth:5.2, centre:[0,23,8.4], modeledFront:2.83},
  mic:{part:'IM69D128SV01XTMA1', body:[3.5,2.65,.98], spacing:30, boardPortDiameter:.6},
  pcb:{size:[48,76,1.6], cornerRadius:3.1, mountingHole:{centers:[[19,33],[-19,33],[-19,-33],[19,-33]],radius:1.18},
    center:[0,63,-6.5], module:'ESP32-S3-WROOM-1-N16R8', package:[18,25.5,3.1], moduleCenter:[-5,22],
    land:{pitch:1.27,sideX:8.75,sideFirstFromTop:7.49,bottomFromEdge:.25,antennaHeight:6}},
  battery:{bay:[51,63,9], dimensionReference:[50.5,63,6.6]},
};

export function wroomLandRows(){
  const {moduleCenter:[x,y],package:[,height],land}=physical.pcb;
  const firstY=y+height/2-land.sideFirstFromTop;
  const bottomY=y-height/2+land.bottomFromEdge;
  return [
    ...[-1,1].map(side=>Array.from({length:14},(_,i)=>[x+side*land.sideX,firstY-i*land.pitch])),
    Array.from({length:12},(_,i)=>[x+(i-5.5)*land.pitch,bottomY]),
  ];
}

export const layers = [
  ['logic-l1','L1','Tín hiệu và pad trên'],
  ['logic-l2','L2','Mặt hồi GND'],
  ['logic-l3','L3','Phân phối nguồn'],
  ['logic-l4','L4','Tín hiệu ở mặt dưới'],
];

const expected = [
  {id:'LCD1', part:physical.display.part, quantity:2},
  {id:'SPK1', part:physical.speaker.part, quantity:2},
  {id:'M1/M2', part:physical.mic.part, quantity:2},
];
export const scenarios = [
  {id:'expected', label:'Đủ mẫu, đúng revision', edit:{}},
  {id:'wrong-revision', label:'Màn giao nhầm Rev1A', edit:{LCD1:{part:physical.display.part.replace('Rev1B','Rev1A')}}},
  {id:'short-delivery', label:'Giao thiếu một micro', edit:{'M1/M2':{quantity:1}}},
  {id:'missing-lot', label:'Màn thiếu nhãn lô', edit:{LCD1:{lot:''}}},
];

export function simulateReceiving(id) {
  const scenario = scenarios.find(entry => entry.id === id);
  if(!scenario)throw new RangeError('Kịch bản nhận mẫu không tồn tại');
  const lines=expected.map(line=>{
    const received={part:line.part,quantity:line.quantity,lot:'SIM-R1',...scenario.edit[line.id]};
    let status='Đủ điều kiện trong ca mô phỏng';
    if(received.part!==line.part)status='Giữ lại · Sai mã hoặc revision';
    else if(received.quantity!==line.quantity)status='Giữ lại · Sai số lượng';
    else if(!received.lot)status='Giữ lại · Thiếu nhãn lô';
    return {...line,received,status,accepted:status==='Đủ điều kiện trong ca mô phỏng'};
  });
  return {scenario:id, evidence:'simulation', physicalMeasurements:0,
    accepted:lines.every(line=>line.accepted),lines};
}
