import * as THREE from './three/three.module.js?v=a0cc1c2d1068';
import {modules, connections, inspectionAngles, logicSockets, boardMounts, carrierFit} from './assembly-data.js?v=a0cc1c2d1068';
import {entries, bomByModule, logicPassives} from './bom-data.js?v=a0cc1c2d1068';
import {layers,physical,wroomLandRows} from './simulation-data.js?v=a0cc1c2d1068';
import {baseSeam,crown,frontSurface,lensCurves,lensStart,rearGrille,rearSurface,shellPoint,shellSection,shellSplit,wallThickness} from './enclosure-profile.js?v=a0cc1c2d1068';

function canvasTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {canvas, texture, ctx: canvas.getContext('2d')};
}

function eyePanel() {
  const {canvas, texture, ctx} = canvasTexture(512, 512);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  let previous = '';
  function paint({open, smile, gazeX, gazeY, strength, dim}) {
    const values = [open, smile, gazeX, gazeY, strength, dim].map(v => Math.round(v * 80) / 80);
    const key = values.join();
    if (key === previous) return false;
    previous = key;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const [aperture, lifted, gx, gy, power, dark] = values;
    const radius = 48, y = 284 + dark * 4;
    const blush=Math.min(.19,(lifted*.12+dark*.17)*power);
    if(blush>.02)for(const x of [144,368]){
      ctx.save();
      ctx.translate(x,y+54);
      ctx.scale(1,.56);
      const shade=ctx.createRadialGradient(0,0,2,0,0,67);
      shade.addColorStop(0,`rgba(214,96,113,${blush})`);
      shade.addColorStop(.48,`rgba(198,81,109,${blush*.53})`);
      shade.addColorStop(1,'rgba(184,78,106,0)');
      ctx.fillStyle=shade;
      ctx.fillRect(-67,-67,134,134);
      ctx.restore();
    }
    for (const x of [172, 340]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, Math.max(.05, aperture));
      ctx.globalAlpha = power;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = dark > .55 ? '#d6b39d' : '#f3c997';
      ctx.fillRect(-radius, -radius, 2 * radius, 2 * radius);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius - 4, radius - 4, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(-55, 16 - lifted * 8);
      ctx.quadraticCurveTo(0, 42 - lifted * 24, 55, 16 - lifted * 8);
      ctx.lineTo(55, -55);
      ctx.lineTo(-55, -55);
      ctx.closePath();
      ctx.clip();
      const iris = ctx.createLinearGradient(0, -52, 0, 52);
      iris.addColorStop(0, '#422410');
      iris.addColorStop(.56, '#26150b');
      iris.addColorStop(1, '#724120');
      ctx.fillStyle = iris;
      ctx.fillRect(-radius, -radius, 2 * radius, 2 * radius);
      ctx.fillStyle = '#160e09';
      ctx.beginPath();
      ctx.ellipse(gx, gy - 1, 28, 29, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe0bb';
      ctx.beginPath();
      ctx.ellipse(gx - 17, gy - 24, 8.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    texture.needsUpdate = true;
    return true;
  }
  return {texture, paint};
}


const std = (color, roughness = .46, metalness = 0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
function screenOutline() {
  const path=new THREE.Shape().moveTo(...lensStart);
  for(const points of lensCurves)path.bezierCurveTo(...points);
  return path.getSpacedPoints(100);
}
const lensOutline=screenOutline();
function ringMesh(points, axis, rings, zFn) {
  const coordinates=[], uv=[], indexes=[];
  const count=points.length;
  for (let row=0;row<rings.length;row++) {
    const [sx,sy,z]=rings[row];
    for (let edge=0;edge<count;edge++) {
      const point=points[edge],x=point.x*sx,y=axis+(point.y-axis)*sy;
      coordinates.push(x,y,zFn(x,y,z));
      uv.push((x+36)/72,(y-43)/79);
      if (row>0 && edge>0) {
        const i=row*count+edge, p=i-count;
        indexes.push(p-1,i-1,i,p-1,i,p);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indexes);
  geometry.computeVertexNormals();
  const normals=geometry.attributes.normal;
  for(let row=0;row<rings.length;row++){
    const a=row*count,b=a+count-1;
    const normal=new THREE.Vector3().fromBufferAttribute(normals,a)
      .add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();
    normals.setXYZ(a,normal.x,normal.y,normal.z);
    normals.setXYZ(b,normal.x,normal.y,normal.z);
  }
  return geometry;
}
const sampleInterval=(start,end,count)=>Array.from({length:count},(_,i)=>start+(end-start)*i/count);
const grilleFirstRow=11,grilleFirstColumn=23;
const grilleAngleEnd=rearGrille.angleStart+rearGrille.columns*rearGrille.anglePitch;
const grilleYEnd=rearGrille.yStart+rearGrille.rows.length*rearGrille.rowPitch;
const frontAngles=[...sampleInterval(-shellSplit,shellSplit,38),shellSplit];
const rearAngles=[
  ...sampleInterval(shellSplit,rearGrille.angleStart,grilleFirstColumn),
  ...sampleInterval(rearGrille.angleStart,grilleAngleEnd,rearGrille.columns),
  ...sampleInterval(grilleAngleEnd,2*Math.PI-shellSplit,23),2*Math.PI-shellSplit,
];
const shellHeights=[
  ...sampleInterval(baseSeam,rearGrille.yStart,grilleFirstRow),
  ...sampleInterval(rearGrille.yStart,grilleYEnd,rearGrille.rows.length),
  ...sampleInterval(grilleYEnd,118,38),
  118,119,120,121,121.9,122.6,123.1,123.45,123.66,123.76,crown,
];

function shellSkin(angles,inside,perforated=false){
  const positions=[],normals=[],faces=[],bores=[];
  const inset=inside?wallThickness:0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),normal=new THREE.Vector3();
  function vertex(theta,y){
    const delta=.005;
    if(y===crown)normal.set(0,1,0);
    else {
      a.fromArray(shellPoint(theta+delta,y,inset)).sub(b.fromArray(shellPoint(theta-delta,y,inset)));
      normal.fromArray(shellPoint(theta,Math.min(crown,y+delta),inset))
        .sub(b.fromArray(shellPoint(theta,Math.max(baseSeam,y-delta),inset)));
      normal.crossVectors(a,normal).normalize();
    }
    if(inside)normal.negate();
    const index=positions.length/3;
    positions.push(...shellPoint(theta,y,inset));
    normals.push(...normal);
    return index;
  }
  const grid=shellHeights.map(y=>angles.map(theta=>vertex(theta,y)));
  for(let row=0;row<shellHeights.length-1;row++){
    for(let col=0;col<angles.length-1;col++){
      const cornerIndices=[grid[row][col],grid[row][col+1],grid[row+1][col+1],grid[row+1][col]];
      const grilleRow=row-grilleFirstRow,grilleColumn=col-grilleFirstColumn;
      const holesInRow=perforated?(rearGrille.rows[grilleRow]??0):0;
      const holesOnLeft=(rearGrille.columns-holesInRow)/2;
      const open=grilleColumn>=holesOnLeft&&grilleColumn<holesOnLeft+holesInRow;
      let triangles=[[0,1,2],[0,2,3]];
      if(open){
        const [theta,thetaNext]=angles.slice(col,col+2);
        const [y,yNext]=shellHeights.slice(row,row+2);
        const centerTheta=(theta+thetaNext)/2,centerY=(y+yNext)/2;
        const [rx]=shellSection(centerY);
        const hole=sampleInterval(0,2*Math.PI,12).map(phi=>new THREE.Vector2(
          centerTheta+rearGrille.holeRadius/rx*Math.cos(phi),centerY+rearGrille.holeRadius*Math.sin(phi)));
        const corners=[new THREE.Vector2(theta,y),new THREE.Vector2(thetaNext,y),
          new THREE.Vector2(thetaNext,yNext),new THREE.Vector2(theta,yNext)];
        triangles=THREE.ShapeUtils.triangulateShape(corners,[hole]);
        for(const {x,y} of hole)cornerIndices.push(vertex(x,y));
        if(!inside)bores.push(hole);
      }
      for(const [a,b,c] of triangles){
        faces.push(cornerIndices[a],cornerIndices[inside?c:b],cornerIndices[inside?b:c]);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setIndex(faces);
  return {geometry,bores};
}

function boreWalls(bores) {
  const coords=[],indices=[];
  for(const hole of bores){
    const first=coords.length/3;
    for(const inset of [0,wallThickness])for(const {x,y} of hole)coords.push(...shellPoint(x,y,inset));
    for(let i=0;i<hole.length;i++){
      const next=(i+1)%hole.length;
      const a=first+i,b=first+next;
      indices.push(a,b,a+hole.length,b,b+hole.length,a+hole.length);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function baseTrim() {
  // The trim continues the same horizontal section as the two shell pieces.
  const footprint=[...frontAngles.slice(0,-1),...rearAngles.slice(0,-1)].reverse().map(theta=>{
    const [x,,z]=shellPoint(theta,baseSeam);
    return [x,z];
  });
  const profile=[[0,.88],[.48,.951],[1.12,.982],[baseSeam,1]];
  const coords=[],indices=[],count=footprint.length;
  for(const [row,[y,scale]] of profile.entries()){
    for(const [i,[x,z]] of footprint.entries()){
      coords.push(x*scale,y,z*scale);
      const a=row*count+i,b=row*count+(i+1)%count;
      if(row>0)indices.push(a-count,a,b-count,a,b,b-count);
    }
  }
  // The top is covered when assembled and remains visible in the exploded view.
  const bottom=coords.length/3, top=bottom+1;
  coords.push(0,0,0,0,baseSeam,0);
  for(let i=0;i<count;i++){
    const next=(i+1)%count,upper=(profile.length-1)*count;
    indices.push(bottom,i,next,top,upper+next,upper+i);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function radial(first,last,count,z) {
  return Array.from({length:count+1},(_,i)=>{
    const t=i/count, s=THREE.MathUtils.lerp(first,last,t);
    return [s,s,z(t)];
  });
}
function mesh(parent,geometry,material,x=0,y=0,z=0) {
  const object=new THREE.Mesh(geometry,material);
  object.position.set(x,y,z);
  parent.add(object);
  return object;
}
function box(parent,w,h,d,x,y,z,material) {
  return mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z);
}
function roundRect(width,height,r) {
  const x=width/2,y=height/2;
  return new THREE.Shape().moveTo(-x+r,-y).lineTo(x-r,-y).quadraticCurveTo(x,-y,x,-y+r)
    .lineTo(x,y-r).quadraticCurveTo(x,y,x-r,y).lineTo(-x+r,y)
    .quadraticCurveTo(-x,y,-x,y-r).lineTo(-x,-y+r).quadraticCurveTo(-x,-y,-x+r,-y);
}
function rounded(parent,w,h,d,r,x,y,z,material,bevel=.3) {
  const geometry=new THREE.ExtrudeGeometry(roundRect(w,h,r),{
    depth:d,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:6,steps:1,
  });
  geometry.translate(0,0,-d/2);
  return mesh(parent,geometry,material,x,y,z);
}
function disc(parent, radius, depth, x,y,z, material, facets=40) {
  const object=mesh(parent,new THREE.CylinderGeometry(radius,radius,depth,facets),material,x,y,z);
  object.rotation.x=Math.PI/2;
  return object;
}
function rim(parent,radius,tube,x,y,z,material) {
  return mesh(parent,new THREE.TorusGeometry(radius,tube,10,48),material,x,y,z);
}
function instanceBoxes(parent,dimensions,locations,material) {
  const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(...dimensions),material,locations.length);
  const matrix=new THREE.Matrix4();
  for (let i=0;i<locations.length;i++) instances.setMatrixAt(i,matrix.makeTranslation(...locations[i]));
  parent.add(instances);
}
function instancedBoxBatches(parent,material,batches){
  const count=batches.reduce((total,[,positions])=>total+positions.length,0);
  const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,count);
  const transform=new THREE.Matrix4();
  let index=0;
  for(const [[w,h,d],positions] of batches){
    transform.makeScale(w,h,d);
    for(const [x,y,z] of positions)instances.setMatrixAt(index++,transform.setPosition(x,y,z));
  }
  parent.add(instances);
}
const pcbChips = [
  // Ref, center, body dimensions and side-pin counts in the board coordinate system.
  {key:'logic-interface',ref:'U12',type:'AXC8T',x:11,y:3,w:3.5,h:5.5,d:.9,pitch:.5,endPitch:1.5,leads:[10,10,2,2],thermal:[2.05,4.05]},
  {key:'logic-voice',ref:'U3',type:'98357',x:-15,y:-9,w:3,h:3,d:.75,pitch:.5,leads:[4,4,4,4]},
  {key:'logic-memory',ref:'U2',type:'TLC5916',x:12,y:-11.8,w:4.4,h:5,d:1.05,pitch:.65,leads:[8,8,0,0],formed:true},
  {key:'logic-clock',ref:'U11',type:'755',x:-3,y:1,w:1.6,h:2.9,d:1.1,pitch:.95,leads:[3,2,0,0],formed:true},
];
const moduleCenter=physical.pcb.moduleCenter;
const footprintMetal='#ad925a';

function padRows(x,y,w,h,pitch,counts,reach,endPitch=pitch){
  return counts.map((count,edge)=>Array.from({length:count},(_,i)=>{
    const t=(i-(count-1)/2)*(edge<2?pitch:endPitch);
    if(edge<2)return [x+(edge===0?-1:1)*(w/2+reach),y+t];
    return [x+t,y+(edge===2?-1:1)*(h/2+reach)];
  }));
}
function chipGeometry(parent,spec,mold,solder,gold){
  const {x,y,w,h,d,pitch,endPitch,leads,type,formed,thermal}=spec;
  const reach=formed?.68:.22, foot=formed?1.4:.72, pinWidth=pitch*.53;
  const rows=padRows(x,y,w,h,pitch,leads,reach,endPitch);
  const landings=[],leadsOnBoard=[];
  for(const [axis,pins] of [rows.slice(0,2),rows.slice(2)].entries()){
    const centers=pins.flat();
    if(!centers.length)continue;
    const padSize=axis?[pinWidth+.12,foot+.27]:[foot+.27,pinWidth+.12];
    const leadSize=axis?[pinWidth,foot]:[foot,pinWidth];
    landings.push([[...padSize,.065],centers.map(([a,b])=>[a,b,.85])]);
    leadsOnBoard.push([[...leadSize,.15],centers.map(([a,b])=>[a,b,.96])]);
  }
  if(formed){
    const risers=rows.slice(0,2).flatMap((row,side)=>row.map(([,y])=>[x+(side?1:-1)*(w/2+.14),y,1.14]));
    leadsOnBoard.push([[.40,pinWidth,.53],risers]);
  }
  instancedBoxBatches(parent,gold,landings);
  instancedBoxBatches(parent,solder,leadsOnBoard);
  if(thermal)box(parent,...thermal,.09,x,y,.90,solder);
  const bodyTop=pcbSurface+.10+d;
  rounded(parent,w-.12,h-.12,d-.12,.21,x,y,bodyTop-d/2,mold,.06);
  placeLabel(parent,'· '+type,x,y-.18,bodyTop+.019,{width:w*.98,height:.85,color:'#c6c9c2'});
}
function label(text, {width=36,height=5, color='#eee9da', background=null, lines=null}={}) {
  const {canvas, texture,ctx}=canvasTexture(512, lines?240:90);
  if (background) {ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.fillStyle=color;
  ctx.font='600 36px monospace';
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(lines){
    for(const [content,y,px] of lines){
      ctx.font='600 '+px+'px monospace';
      ctx.fillText(content,canvas.width/2,y);
    }
  }else ctx.fillText(text,canvas.width/2,canvas.height/2);
  texture.needsUpdate=true;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),
    new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
}
function placeLabel(parent,text,x,y,z,settings) {
  const mark=label(text,settings);
  mark.position.set(x,y,z);
  parent.add(mark);
}

const pcbSurface=physical.pcb.size[2]/2;
function boardOutline() {
  const {size:[width,height],cornerRadius,mountingHole}=physical.pcb;
  const outline=roundRect(width,height,cornerRadius);
  for(const [x,y] of mountingHole.centers){
    const hole=new THREE.Path();
    hole.absarc(x,y,mountingHole.radius,0,Math.PI*2,true);
    outline.holes.push(hole);
  }
  return outline;
}
function boardUV(geometry) {
  const [width,height]=physical.pcb.size;
  const position=geometry.attributes.position, uv=geometry.attributes.uv;
  for(let i=0;i<position.count;i++)uv.setXY(i,position.getX(i)/width+.5,position.getY(i)/height+.5);
}
function etchedBoard(parent,outline,materials) {
  const geometry=new THREE.ExtrudeGeometry(outline,{
    depth:physical.pcb.size[2],bevelEnabled:false,curveSegments:12,
  });
  geometry.translate(0,0,-pcbSurface);
  boardUV(geometry);
  // Assign each triangle to either cap or the cut edge, using its actual local normal.
  const normals=geometry.attributes.normal;
  geometry.clearGroups();
  let start=0,face=-1;
  for(let i=0;i<normals.count;i+=3){
    const z=normals.getZ(i);
    const next=z>.99?0:z<-.99?3:4;
    if(next===4){
      for(let vertex=i;vertex<i+3;vertex++){
        geometry.attributes.uv.setXY(vertex,.5,(geometry.attributes.position.getZ(vertex)+pcbSurface)/(2*pcbSurface));
      }
    }
    if(next===face)continue;
    if(i>start)geometry.addGroup(start,i-start,face);
    start=i;face=next;
  }
  geometry.addGroup(start,normals.count-start,face);
  mesh(parent,geometry,materials);
}

function pcbCutEdge() {
  const {ctx,texture}=canvasTexture(4,96);
  ctx.fillStyle='#aa9871';
  ctx.fillRect(0,0,4,96);
  for(const y of [30,64]){
    ctx.fillStyle='#817b59';
    ctx.fillRect(0,y,4,3);
  }
  ctx.fillStyle='#23564a';
  ctx.fillRect(0,0,4,6);
  ctx.fillRect(0,90,4,6);
  texture.needsUpdate=true;
  return new THREE.MeshStandardMaterial({
    map:texture, roughness:.79, emissive:'#322b17', emissiveIntensity:.32,
  });
}

function copperMaterial(index) {
  const [w,h]=physical.pcb.size;
  const {canvas,ctx,texture}=canvasTexture(768,1216);
  ctx.translate(canvas.width/2,canvas.height/2);
  ctx.scale(canvas.width/w,-canvas.height/h);
  ctx.fillStyle=index===0||index===3?'#155246':'#354339';
  ctx.fillRect(-24,-38,48,76);
  ctx.lineJoin='round';
  ctx.lineCap='round';
  if(index===1||index===2){
    ctx.fillStyle=index===1?'#a66f3c':'#ad8051';
    ctx.fillRect(-22,-36,44,57);
    ctx.strokeStyle='#485948';
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(-23,index===1?-16:-21);
    ctx.lineTo(-13,index===1?-16:-21);
    ctx.lineTo(0,index===1?-7:-34);
    ctx.lineTo(22,index===1?-7:-34);
    ctx.stroke();
  }else{
    const front=index===0;
    const mirror=front?1:-1;
    ctx.scale(mirror,1);
    const via=(x,y,r=.26)=>{
      ctx.fillStyle=footprintMetal;
      ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fill();
      ctx.fillStyle='#15231c';
      ctx.beginPath();ctx.arc(x,y,r*.46,0,2*Math.PI);ctx.fill();
    };
    function route(x,y,toX,toY,tint){
      const run=Math.min(Math.abs(toX-x),Math.abs(toY-y))*.65;
      ctx.strokeStyle=tint;ctx.lineWidth=.155;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(x+Math.sign(toX-x)*run,y+Math.sign(toY-y)*run);
      ctx.lineTo(toX,y+Math.sign(toY-y)*run);ctx.lineTo(toX,toY);ctx.stroke();
      via(toX,toY,.20);
    }
    for(const [side,pins] of wroomLandRows().entries()){
      for(const [i,[x,y]] of pins.entries()){
        const dir=side===0?-1:1;
        const fan=side===2?[(i-5.5)*.24,-1.9-(i%3)*.68]:[dir*(2.3+(i%4)*.82),.39+(i%4)*.33];
        route(x,y,x+fan[0],y+fan[1],i%3===0?'#658f6f':'#3b7a65');
      }
    }
    for(const chip of pcbChips){
      for(const [side,pins] of padRows(chip.x,chip.y,chip.w,chip.h,chip.pitch,chip.leads,1,chip.endPitch).entries()){
        pins.forEach(([x,y],i)=>{
          const t=1.45+(i%4)*.56, dir=side%2===0?-1:1;
          route(x,y,x+(side<2?dir*t:.29*(i%3-1)),y+(side<2?.61*(i%3-1):dir*t),'#438770');
        });
      }
    }
    for(const [i,{x,y,vertical}] of logicPassives.entries()){
      const end=i%2?1:-1, dx=vertical?0:end,dy=vertical?end:0;
      route(x+dx*.8,y+dy*.8,x+dx*2.1,y+dy*1.7,'#438770');
    }
    const [jx,jy]=logicSockets['logic-j1'];
    for(let i=0;i<physical.display.fpc;i+=2){
      const x=jx+(i-(physical.display.fpc-1)/2)*physical.display.connector.pitch;
      route(x,jy-physical.display.connector.body[1]/2,x+(i-19.5)*.33,jy-4.4-(i%6)*.38,'#498772');
    }
    // Draw the module antenna footprint. The board-wide RF keepout is still open.
    const [moduleWidth,moduleHeight]=physical.pcb.package;
    const {antennaHeight}=physical.pcb.land;
    const antennaLeft=moduleCenter[0]-moduleWidth/2;
    const antennaBottom=moduleCenter[1]+moduleHeight/2-antennaHeight;
    ctx.fillStyle='#1b3030';
    ctx.fillRect(antennaLeft,antennaBottom,moduleWidth,antennaHeight);
    ctx.strokeStyle='#86a69c80';ctx.lineWidth=.12;
    ctx.setLineDash([.67,.47]);ctx.strokeRect(antennaLeft,antennaBottom,moduleWidth,antennaHeight);ctx.setLineDash([]);
    if(front){
      ctx.scale(1,-1);
      ctx.fillStyle='#d1dcc5';
      ctx.font='600 1.22px monospace';ctx.textBaseline='middle';
      for(const [name,x,y] of [
        ['TRI KỶ  /  MAIN  R1',-21,-35.8],['U1',-21,26],['J-MIC',11.9,31.4],
        ['J1  DISPLAY',-8,-14.9],['J3  SPK',-17,-34.5],['J4  PWR',9,-34.5],
        ['TP1 – TP6',2,-21.9],...pcbChips.map(chip=>[chip.ref,chip.x-chip.w/2,chip.y+chip.h/2+.9]),
      ])ctx.fillText(name,x,-y);
    }
  }
  texture.anisotropy=4;
  return new THREE.MeshStandardMaterial({
    map:texture,roughness:.49,metalness:index===1||index===2?.52:.32,side:THREE.DoubleSide,
  });
}

function lighting(renderer,scene) {
  const studio=new THREE.Scene();
  studio.background=new THREE.Color('#444348');
  for (const [x,y,z,w,h,level,color] of [
    [-60,26,155,27,44,6.2,'#fff4e7'], [-62,2,155,21,7,3.4,'#ffeddf'],
    [-31,32,150,14,25,2.45,'#fff9ef'],
    [24,207,30,138,86,1.48,'#edf2ff'], [119,139,-39,86,116,2.60,'#fff0db'],
    [88,71,116,30,53,1.05,'#d7dcef'],
  ]) {
    const emitter=mesh(studio,new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(level),side:THREE.DoubleSide}),x,y,z);
    emitter.lookAt(0,65,0);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(studio,.038,1,350,{size:128});
  pmrem.dispose();
  for (const item of studio.children) {item.geometry.dispose();item.material.dispose();}
  scene.environment=environment.texture;
  scene.environmentIntensity=1.04;
  const key=new THREE.DirectionalLight('#fff6ed',2.36);
  const fill=new THREE.DirectionalLight('#edf2ff',.70);
  const back=new THREE.DirectionalLight('#fff6e9',.83);
  key.position.set(-100,145,120);
  fill.position.set(100,106,115);
  back.position.set(96,126,-109);
  scene.add(key,fill,back,new THREE.HemisphereLight('#f6f6f5','#68676b',1.00));
  return environment;
}
function materialGrain() {
  const {ctx,texture}=canvasTexture(96,96);
  texture.colorSpace=THREE.NoColorSpace;
  const data=ctx.createImageData(96,96);
  let seed=141;
  for (let i=0;i<data.data.length;i+=4) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const value=102+(seed>>>25);
    data.data[i]=data.data[i+1]=data.data[i+2]=value;
    data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(7,9);
  texture.needsUpdate=true;
  return texture;
}
function makeShadow() {
  const {ctx,texture}=canvasTexture(128,128);
  const radial=ctx.createRadialGradient(64,64,4,64,64,64);
  radial.addColorStop(0,'#241c1463');radial.addColorStop(.45,'#241c1431');radial.addColorStop(1,'#241c1400');
  ctx.fillStyle=radial;ctx.fillRect(0,0,128,128);
  texture.needsUpdate=true;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(155,105),
    new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
  floor.rotation.x=-Math.PI/2;
  floor.position.set(0,-.8,0);
  return floor;
}

export function makeAssembly(renderer,scene) {
  const environment=lighting(renderer,scene), shadow=makeShadow();
  const root=new THREE.Group();
  scene.add(root,shadow);
  const parts=Object.fromEntries(modules.map(part=>{
    const group=new THREE.Group();
    group.name=part.name;
    group.userData.part=part.id;
    root.add(group);
    return [part.id,group];
  }));
  const leaf=Object.fromEntries(entries.map(item=>{
    const group=new THREE.Group();
    group.name=item.ref+' · '+item.name;
    group.userData.item=item.key;
    parts[item.module].add(group);
    return [item.key,group];
  }));
  const eye=eyePanel();
  const ceramic=new THREE.MeshStandardMaterial({
    color:'#cdb3a2', roughness:.48, metalness:0, bumpMap:materialGrain(), bumpScale:.065, side:THREE.DoubleSide,
  });
  const champagne=std('#f0cdb1',.20,.48);champagne.side=THREE.DoubleSide;
  const baseChampagne=std('#e5bfa1',.23,.67);
  const inner=std('#3d3938',.62,.04);inner.side=THREE.DoubleSide;
  const aluminum=std('#a6aba8',.27,.77);
  const graphite=std('#202526',.56,.12),black=std('#141719',.57,.08);
  const gold=std('#d8b776',.29,.74), solder=std('#b3af9f',.32,.68);
  const pcb=new THREE.MeshStandardMaterial({color:'#055941', roughness:.43, metalness:.09});
  const sand=std('#bca17b',.67);
  const lens=new THREE.MeshPhysicalMaterial({
    color:'#070708',roughness:.16,metalness:.06,clearcoat:.98,clearcoatRoughness:.06,
    emissive:'#fff',emissiveIntensity:1.07,emissiveMap:eye.texture,envMapIntensity:1.05,side:THREE.DoubleSide,
  });
  // An analytic softbox preserves the pane silhouette after PMREM filtering.
  // It responds to the same world-space reflection direction as the glass environment.
  lens.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 reflectedWorld = inverseTransformDirection(
        reflect(-geometryViewDir, geometryClearcoatNormal), viewMatrix
      );
      vec2 panelDirection = reflectedWorld.xy / max(.15, reflectedWorld.z);
      vec2 softbox = panelDirection - vec2(-.386, .102);
      softbox.x += .17 * softbox.y;
      float paneMask = (1.0 - smoothstep(.043, .106, abs(softbox.x))) *
        (1.0 - smoothstep(.104, .172, abs(softbox.y)));
      float mullion = .58 + .42 * smoothstep(.005, .021, abs(softbox.y - .03));
      float spill = .20 * exp(-34.0 * dot(softbox, softbox));
      float eyeEmission = max(totalEmissiveRadiance.r, totalEmissiveRadiance.g);
      vec2 windowPos = vEmissiveMapUv - vec2(.5, .90) - panelDirection * vec2(.36, .28);
      windowPos.y += .36 * windowPos.x * windowPos.x;
      float windowMask = (1.0 - smoothstep(.22, .44, abs(windowPos.x))) *
        (1.0 - smoothstep(.09, .29, abs(windowPos.y))) *
        smoothstep(.58, .80, vEmissiveMapUv.y);
      float mullionX = smoothstep(.009, .021, abs(mod(windowPos.x, .185) - .0925));
      float mullionY = smoothstep(.008, .018, abs(mod(windowPos.y, .13) - .065));
      float gloss = (.52 * paneMask * mullion + spill) * smoothstep(.4, .8, reflectedWorld.z);
      vec3 glassReflection = vec3(.215, .189, .160) * gloss +
        vec3(.161, .167, .176) * windowMask * mix(.38, 1.0, mullionX * mullionY);
      outgoingLight += glassReflection * (1.0 - .65 * clamp(eyeEmission, 0.0, 1.0));
      #include <opaque_fragment>
    `);
  };

  // The two shell pieces share surface positions and normals at the parting line.
  const glassSurface=(x,y,offset)=>frontSurface(x,y)+offset;
  mesh(leaf['face-cover'],shellSkin(frontAngles,false).geometry,ceramic);
  mesh(leaf['face-cover'],shellSkin(frontAngles,true).geometry,inner);
  mesh(leaf['face-bezel'],ringMesh(lensOutline,83,[[1.041,1.035,.13],[1.033,1.028,.41],[1.019,1.016,.84],[1,1,.68]],glassSurface),champagne);
  mesh(leaf['face-glass'],ringMesh(lensOutline,83,radial(1,.003,32,t=>.68+.025*t),glassSurface),lens);
  const back=shellSkin(rearAngles,false,true);
  mesh(leaf['housing-body'],back.geometry,ceramic);
  mesh(leaf['housing-body'],shellSkin(rearAngles,true,true).geometry,inner);
  mesh(leaf['housing-body'],boreWalls(back.bores),std('#796253',.73));
  const gasket=std('#373532',.71);gasket.side=THREE.DoubleSide;
  for(const theta of [-shellSplit,shellSplit]){
    const points=shellHeights.slice(0,-3).map(y=>new THREE.Vector3(...shellPoint(theta,y,1.23)));
    const seam=new THREE.CatmullRomCurve3(points);
    mesh(leaf['housing-gasket'],new THREE.TubeGeometry(seam,55,.29,6),gasket);
  }
  for (const x of [-22,22]) for (const y of [18,68,104]) {
    const surface=Math.max(...[x-2.05,x,x+2.05].flatMap(px=>
      [y-2.05,y,y+2.05].map(py=>rearSurface(px,py,wallThickness))));
    disc(leaf['housing-inserts'],2.05,3.4,x,y,surface+1.65,graphite,14);
    rim(leaf['housing-inserts'],.76,.25,x,y,surface+3.4,solder);
  }
  const switchMesh=rounded(leaf['housing-switch'],4.2,14.,1.8,1.8,...shellPoint(Math.PI/2,66,.4),champagne,.3);
  switchMesh.rotation.y=Math.PI/2;
  const usbY=11,usbFace=shellPoint(Math.PI,usbY)[2];
  const usbOpening=rounded(leaf['housing-body'],9.2,3.8,.34,1.4,0,usbY,usbFace+.05,graphite,.15);
  usbOpening.rotation.y=Math.PI;
  mesh(leaf['base-body'],baseTrim(),baseChampagne);
  for (const x of [-18,18]) {
    mesh(leaf['base-feet'],new THREE.CylinderGeometry(4,4,.55,18),black,x,.2,8);
    mesh(leaf['base-feet'],new THREE.CylinderGeometry(4,4,.55,18),black,x,.2,-8);
  }

  // Rev1B outline, vertical active area and FPC ribbon.
  const [dw,dh,dt]=physical.display.body, [aw,ah]=physical.display.active;
  for(const x of [-24.4,24.4])rounded(leaf['display-frame'],1.55,dh+.18,.75,.40,x,0,-1.5,aluminum,.10);
  rounded(leaf['display-frame'],dw+.18,1.4,.75,.4,0,dh/2-.7,-1.5,aluminum,.10);
  for(const x of [-17.8,17.8])rounded(leaf['display-frame'],12.8,1.4,.75,.4,x,-dh/2+.7,-1.5,aluminum,.10);
  rounded(leaf['display-panel'],dw,dh,dt,1.45,0,0,0,graphite,.09);
  rounded(leaf['display-panel'],aw,ah,.23,1.45,0,physical.display.bodyToActive,1.3,std('#192831',.32,.46),.03);
  placeLabel(leaf['display-panel'],'REV 1B',0,-31,1.24,{color:'#aab8b4',width:17,height:3});
  const flexPath=physical.display.flexPath;
  const {pitch,tailWidth}=physical.display.connector;
  const halfTail=tailWidth/2;
  const flexPads=Array.from({length:physical.display.fpc},(_,i)=>(i-(physical.display.fpc-1)/2)*pitch);
  const vertices=flexPath.flatMap(([y,z])=>[-halfTail,y,z,halfTail,y,z]);
  const indices=flexPath.slice(1).flatMap((_,i)=>[2*i,2*i+1,2*i+2,2*i+1,2*i+3,2*i+2]);
  const ribbonGeom=new THREE.BufferGeometry();
  ribbonGeom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  ribbonGeom.setIndex(indices);
  ribbonGeom.computeVertexNormals();
  const kapton=std('#a0501b',.33,.27);
  kapton.side=THREE.DoubleSide;
  mesh(leaf['display-flex'],ribbonGeom,kapton);
  const [endY,endZ]=flexPath.at(-1);
  instanceBoxes(leaf['display-flex'],[.29,.28,2.7],flexPads.map(x=>[x,endY-.45,endZ+1.22]),gold);

  // Bottom-port PDM capsules and separate acoustic gaskets.
  const micOutline=roundRect(39,7.2,1.2);
  for(const x of [-physical.mic.spacing/2,physical.mic.spacing/2]){
    const port=new THREE.Path();
    port.absarc(x,0,physical.mic.boardPortDiameter/2,0,Math.PI*2,true);
    micOutline.holes.push(port);
  }
  const micBoard=new THREE.ExtrudeGeometry(micOutline,{depth:1.15,bevelEnabled:false,curveSegments:9});
  mesh(leaf['mic-pcb'],micBoard,pcb,0,0,-.575);
  for(const x of [-physical.mic.spacing/2,physical.mic.spacing/2]){
    const [w,h,d]=physical.mic.body;
    rounded(leaf['mic-capsules'],w-.14,h-.14,d-.14,.38,x,0,.575+d/2,aluminum,.07);
    disc(leaf['mic-capsules'],.28,.06,x,0,.565,black,18);
    placeLabel(leaf['mic-capsules'],'·',x-.94,.53,.575+d+.008,{width:1,height:1,color:'#343a37'});
    disc(leaf['mic-pcb'],.63,.15,x+(x<0?-3.15:3.15),0,.69,gold,16);
  }
  instanceBoxes(leaf['mic-filter'],[.88,1.79,.24],Array.from({length:5},(_,i)=>[-4.6+i*2.3,0,.72]),sand);

  // Round speaker, gasket, membrane and a separately inspectable rear cup.
  const radius=physical.speaker.diameter/2;
  disc(leaf['speaker-basket'],radius,1.65,0,0,1.64,aluminum,64);
  disc(leaf['speaker-magnet'],7.3,2.3,0,0,-1.37,aluminum,44);
  disc(leaf['speaker-magnet'],5.65,.32,0,0,-2.58,black,40);
  rim(leaf['speaker-ring'],12.0,.89,0,0,2.40,std('#373b3b',.66));
  rim(leaf['speaker-ring'],13.35,.39,0,0,2.44,graphite);
  const membrane=new THREE.LatheGeometry([
    new THREE.Vector2(0,0),new THREE.Vector2(5.3,.17),new THREE.Vector2(8.5,.54),
    new THREE.Vector2(11.5,.98),new THREE.Vector2(11.75,.98),
  ],64);
  const diaphragm=mesh(leaf['speaker-cone'],membrane,graphite,0,0,1.34);
  diaphragm.rotation.x=Math.PI/2;
  disc(leaf['speaker-cone'],4.45,.65,0,0,1.78,black);
  instanceBoxes(leaf['speaker-basket'],[1.3,.9,.36],[[8.9,-8.1,-1],[10.4,-8.1,-1]],solder);
  const cavity=new THREE.LatheGeometry([
    [0,-11.55],[17.1,-11.55],[18,-10.75],[18,-3.12],[16,-3.12],
    [16,-9.95],[0,-9.95],
  ].map(([r,z])=>new THREE.Vector2(r,z)),72);
  const cup=mesh(leaf['speaker-chamber'],cavity,graphite);
  cup.rotation.x=Math.PI/2;
  rim(leaf['speaker-chamber'],16.95,.45,0,0,-3.13,black);
  // Populated layout referenced to the board, with separately inspectable copper layers.
  const outline=boardOutline();
  const copperMaterials=layers.map((_,index)=>copperMaterial(index));
  etchedBoard(leaf['logic-pcb'],outline,[...copperMaterials,pcbCutEdge()]);
  const copperGeometry=new THREE.ShapeGeometry(outline,12);
  boardUV(copperGeometry);
  layers.forEach(([key],index)=>{
    mesh(leaf[key],copperGeometry,copperMaterials[index],0,0,pcbSurface*(1-index*2/3));
  });
  for(const [x,y] of physical.pcb.mountingHole.centers){
    rim(leaf['logic-pcb'],1.43,.22,x,y,.79,gold);
  }
  const processor=leaf['logic-processor'];
  const [mx,my]=moduleCenter,[mw,mh,md]=physical.pcb.package;
  const moduleBase=pcbSurface+.12,moduleTop=moduleBase+md;
  const shield=new THREE.MeshPhysicalMaterial({
    color:'#c4c9c7',roughness:.31,metalness:.93,anisotropy:.48,anisotropyRotation:Math.PI/2,
  });
  const laminate=std('#1c322e',.53,.10), moldedIc=std('#232925',.66,.12);
  const bareMask=std('#152823',.67), markerInk='#202c28';
  rounded(processor,mw-.14,mh-.14,.76,.41,mx,my,moduleBase+.38,laminate,.07);
  rounded(processor,16.4,18.6,.43,.42,mx,my-2.82,moduleBase+.94,black,.08);
  rounded(processor,16.05,18.18,md-1.12,.49,mx,my-2.82,moduleTop-(md-1.12)/2-.14,shield,.14);
  rounded(processor,16.1,5.07,.16,.17,mx,my+9.65,moduleBase+.90,bareMask,.04);
  placeLabel(processor,'',mx,my-1,moduleTop+.016,{width:15.9,height:8,color:markerInk,lines:[
    ['ESPRESSIF',44,38],['ESP32-S3-WROOM-1',130,30],['N16R8',194,27],
  ]});
  const [left,right,lower]=wroomLandRows();
  const moduleGold=[],moduleSolder=[];
  for(const [vertical,pins] of [[true,left.concat(right)],[false,lower]]){
    const footprint=vertical?[1.5,.9,.07]:[.9,1.5,.07];
    const lead=vertical?[1.06,.56,.24]:[.56,1.06,.24];
    moduleGold.push([footprint,pins.map(([x,y])=>[x,y,.865])]);
    moduleSolder.push([lead,pins.map(([x,y])=>[x,y,1.018])]);
    moduleGold.push([vertical?[.20,.50,.52]:[.50,.20,.52],pins.map(([x,y])=>
      [x-(vertical?Math.sign(x-mx)*.33:0),y+(vertical?0:.33),1.25])]);
  }
  moduleGold.push([[.9,.9,.07],[-1.4,0,1.4].flatMap(dx=>
    [-1.4,0,1.4].map(dy=>[mx-1.25+dx,lower[0][1]+10.29+dy,.865]))]);
  instancedBoxBatches(processor,gold,moduleGold);
  instancedBoxBatches(processor,solder,moduleSolder);
  for(const spec of pcbChips)chipGeometry(leaf[spec.key],spec,moldedIc,solder,gold);
  const passives=leaf['logic-passives'];
  const smdGold=[],smdSolder=[];
  for(const vertical of [false,true]){
    const orient=(w,h,d)=>vertical?[h,w,d]:[w,h,d];
    const aligned=logicPassives.filter(part=>part.vertical===vertical);
    for(const [kind,material] of [['capacitor',sand],['resistor',moldedIc]]){
      const bodies=aligned.filter(part=>part.kind===kind);
      const d=kind==='capacitor'?.57:.38;
      instanceBoxes(passives,orient(1.12,.89,d),bodies.map(({x,y})=>[x,y,.94+d/2]),material);
    }
    const contacts=aligned.flatMap(({x,y})=>[-.75,.75].map(sign=>
      [x+(vertical?0:sign),y+(vertical?sign:0)]));
    smdGold.push([orient(.79,1.11,.065),contacts.map(([x,y])=>[x,y,.859])]);
    smdSolder.push([orient(.45,.91,.41),contacts.map(([x,y])=>[x,y,1.15])]);
  }
  instancedBoxBatches(passives,gold,smdGold);
  instancedBoxBatches(passives,solder,smdSolder);
  const testPads=new THREE.InstancedMesh(new THREE.CylinderGeometry(.64,.64,.12,16)
    .rotateX(Math.PI/2),gold,6);
  const padPosition=new THREE.Matrix4();
  for(let i=0;i<testPads.count;i++)testPads.setMatrixAt(i,padPosition.makeTranslation(2+i*2.05,-23,.897));
  leaf['logic-test'].add(testPads);

  const connectorBody=std('#cfbf9f',.48,.04);
  for(const [key,[x,y,z]] of Object.entries(logicSockets)){
    const connector=leaf[key], lcd=key==='logic-j1';
    const pins=lcd?physical.display.fpc:key==='logic-j2'?5:key==='logic-j3'?2:3;
    const pitch=lcd?physical.display.connector.pitch:1.17;
    const [w,h,d]=lcd?physical.display.connector.body:[2.7+pins*pitch,3.8,2.75];
    const top=pcbSurface+d;
    rounded(connector,w-.16,h-.16,.53,.23,x,y,1.16,connectorBody,.08);
    const wallHeight=top-1.37, wallCenter=top-wallHeight/2;
    instancedBoxBatches(connector,connectorBody,[
      [[.61,h-.10,wallHeight],[[x-w/2+.27,y,wallCenter],[x+w/2-.27,y,wallCenter]]],
      [[w-.72,.64,wallHeight],[[x,y+h/2-.39,wallCenter]]],
    ]);
    if(lcd){
      rounded(connector,w-1.4,.95,.49,.16,x,y+.52,top-.24,graphite,.05);
      box(connector,w-1.31,.36,.51,x,y-.58,z+.22,black);
    }
    const offsets=Array.from({length:pins},(_,i)=>x+(i-(pins-1)/2)*pitch);
    instancedBoxBatches(connector,gold,[
      [[lcd?.26:.55,1.18,.09],offsets.map(px=>[px,y-h/2-.35,.865])],
      [[lcd?.20:.40,lcd?1.33:1.8,.14],offsets.map(px=>[px,y-.12,1.54])],
    ]);
    instancedBoxBatches(connector,solder,[
      [[lcd?.18:.35,1.15,.16],offsets.map(px=>[px,y-h/2-.19,.97])],
      [[.94,1.89,.32],[[x-w/2+.22,y,.98],[x+w/2-.22,y,.98]]],
    ]);
  }

  // Pack envelope from the reference drawing. PCM and NTC positions are provisional.
  const [bw,bh,bd]=physical.battery.dimensionReference;
  rounded(leaf['battery-cell'],bw,bh,bd,3.1,0,0,0,aluminum,.35);
  rounded(leaf['battery-cell'],bw-2.7,bh-3.2,.19,2.4,0,0,bd/2+.10,std('#d9d7ce',.44,.32),.07);
  rounded(leaf['battery-guard'],32,3.15,.58,.9,0,-28.2,bd/2+.79,pcb,.10);
  rounded(leaf['battery-guard'],4.4,1.95,.55,.22,0,-28.2,bd/2+1.15,graphite,.05);
  placeLabel(leaf['battery-cell'],'Li-ion 1S',0,3,bd/2+.22,{color:'#333532',width:26,height:5.7});
  placeLabel(leaf['battery-cell'],'PCM + NTC',0,-3,bd/2+.22,{color:'#4f514f',width:22,height:4});
  for(const [i,color] of ['#b85543','#222627','#d2ae49'].entries()) {
    box(leaf['battery-tabs'],1.02,5.5,.65,-8+i*3.25,-32.52,.94,std(color,.53));
  }

  // Power and connector board with shaped USB-C shell and contact tongue.
  rounded(leaf['io-pcb'],41,13,1.4,2.2,0,0,0,pcb,.22);
  const jack=new THREE.Group();
  const ioOrigin=modules.find(part=>part.id==='io').origin;
  jack.position.set(0,usbY-ioOrigin[1],usbFace-ioOrigin[2]+4.18);
  leaf['io-port'].add(jack);
  rounded(jack,9.4,3.6,7.8,1.7,0,0,0,aluminum,.24);
  rounded(jack,7.1,2.1,.31,.95,0,0,-4.18,black,.08);
  rounded(jack,5.45,.63,.3,.26,0,0,-4.42,graphite,.04);
  instanceBoxes(leaf['io-pcb'],[.95,1.2,.16],[[14,5,1],[15.5,5,1],[-13,5,1],[-11.5,5,1]],gold);
  rounded(leaf['io-power'],1.52,1.52,.32,.15,-13,1.2,.9,graphite,.04);
  rounded(leaf['io-power'],3.82,3.82,.57,.21,12,1.2,1.075,graphite,.09);
  for (const x of [-17,17]) rim(leaf['io-pcb'],1.32,.34,x,-3,.80,gold);

  // Internal carrier with a genuine open frame, cross braces and standoffs.
  const {frameDepth,frameBevel,screwDiameter}=carrierFit;
  const firstRow=Math.min(...boardMounts.map(([,y])=>y)),lastRow=Math.max(...boardMounts.map(([,y])=>y));
  const frameMiddle=(firstRow+lastRow)/2;
  const frameFront=frameDepth/2+frameBevel;
  for(const x of [-24.6,24.6]){
    rounded(leaf['carrier-frame'],4.2,lastRow-firstRow+8,frameDepth,1.2,x,frameMiddle,0,graphite,frameBevel);
  }
  for(const y of [firstRow,lastRow])rounded(leaf['carrier-frame'],50,4.8,frameDepth,1.2,0,y,0,graphite,frameBevel);
  for(const dy of [-17,17])rounded(leaf['carrier-frame'],47,2.9,frameDepth,.84,0,frameMiddle+dy,0,graphite,frameBevel);
  for(const [x,y,seat] of boardMounts){
    const bossBase=frameFront-.07;
    disc(leaf['carrier-posts'],2.20,seat-bossBase,x,y,(seat+bossBase)/2,graphite,20);
    const front=seat+physical.pcb.size[2];
    disc(leaf['carrier-screws'],screwDiameter/2,front-frameFront,x,y,(front+frameFront)/2,solder,18);
    disc(leaf['carrier-screws'],1.65,.58,x,y,front+.29,aluminum,20);
    box(leaf['carrier-screws'],2.35,.29,.08,x,y,front+.62,graphite);
  }

  // Short routed segments act as physical placeholders for the cable families.
  rounded(leaf['cable-panel'],tailWidth,4.0,.28,1.2,0,5,1.1,std('#b3703b',.47),.06);
  instanceBoxes(leaf['cable-panel'],[.3,1.5,.13],flexPads.map(x=>[x,4.4,1.4]),gold);
  const cableMaterials=[std('#b5684c',.55),std('#222526',.66),std('#657d73',.53),std('#cbc1a4',.48)];
  for(const [i,key] of ['cable-mic','cable-speaker','cable-battery','cable-power'].entries()){
    const y=1.7-i*2.35;
    const g=leaf[key];
    for(let j=0;j<2;j++){
      const start=new THREE.Vector3(-8.4,y+.43*j,-.05);
      const end=new THREE.Vector3(8.4,y+.43*j,.0);
      const mid=new THREE.Vector3(0,y+.65+.43*j,1.4);
      const curve=new THREE.QuadraticBezierCurve3(start,mid,end);
      mesh(g,new THREE.TubeGeometry(curve,15,.22,7),cableMaterials[(i+j)%4]);
    }
    for(const x of [-8.4,8.4])box(g,1.85,1.0,.92,x,y+.20,.01,sand);
  }

  const wires=connections.map(connection=>{
    const geometry=new THREE.BufferGeometry();
    const array=new Float32Array(25*3);
    geometry.setAttribute('position',new THREE.BufferAttribute(array,3));
    const material=new THREE.LineDashedMaterial({color:connection.color,dashSize:2.2,gapSize:1.35,transparent:true,opacity:.9});
    const line=new THREE.Line(geometry,material);
    line.frustumCulled=false;
    line.visible=false;
    scene.add(line);
    return {connection,line};
  });
  const anchors=Object.fromEntries(modules.map(part=>[part.id,new THREE.Vector3(...part.mark)]));
  const contact=new THREE.Vector3(),end=new THREE.Vector3(),bend1=new THREE.Vector3(),bend2=new THREE.Vector3(),point=new THREE.Vector3();
  function setPose(explosion, isolated, showLinks, selection, compact) {
    for (const part of modules) {
      const object=parts[part.id];
      const t=THREE.MathUtils.clamp((explosion-part.release)/(1-part.release),0,1);
      const travel=t*t*(3-2*t);
      const [pitch,yaw,roll]=inspectionAngles[part.id];
      object.position.set(...part.origin);
      object.position.addScaledVector((compact?compactSpread:spread)[part.id],travel);
      const turn=travel*(compact&&part.id!=='io'?.75:1);
      object.rotation.set(pitch*turn,yaw*turn,roll*turn);
      object.visible=!isolated || part.id===isolated;
    }
    shadow.visible=!isolated&&explosion<.27;
    shadow.material.opacity=1-Math.min(1,explosion/.27);
    for(const {footprint,component,stageShadow} of separatedShadows){
      const drop=component.position.y+footprint.min.y-(compact?-112:-26);
      stageShadow.visible=!isolated&&explosion>.44&&drop<150;
      if(!stageShadow.visible)continue;
      stageShadow.material.opacity=.29*Math.min(1,(explosion-.44)*3)*Math.max(.2,1-drop/210);
      stageShadow.position.set(component.position.x,(compact?-112:-26.55),component.position.z-8);
    }
    for (const {line,connection} of wires) {
      line.visible=showLinks && !isolated && explosion>.13;
      if (!line.visible) continue;
      const launcher=parts[connection.from],receiver=parts[connection.to];
      contact.set(...connection.a).applyQuaternion(launcher.quaternion).add(launcher.position);
      end.set(...connection.b).applyQuaternion(receiver.quaternion).add(receiver.position);
      bend1.copy(contact).lerp(end,.33);bend1.z+=14+15*explosion;
      bend2.copy(contact).lerp(end,.68);bend2.z+=12+12*explosion;
      const curve=new THREE.CubicBezierCurve3(contact,bend1,bend2,end);
      const points=line.geometry.attributes.position;
      for(let i=0;i<25;i++){
        curve.getPoint(i/24,point);
        points.setXYZ(i,point.x,point.y,point.z);
      }
      points.needsUpdate=true;
      line.computeLineDistances();
      line.material.opacity=(!selection || connection.from===selection || connection.to===selection) ? .96 : .25;
    }
  }
  const spread=Object.fromEntries(modules.map(part=>[part.id,new THREE.Vector3(...part.spread)]));
  const compactSpread=Object.fromEntries(modules.map(part=>[part.id,new THREE.Vector3(...part.compact)]));
  const separatedShadows=modules.map(({id})=>{
    const component=parts[id],footprint=new THREE.Box3().setFromObject(component);
    const width=footprint.max.x-footprint.min.x;
    const stageShadow=new THREE.Mesh(new THREE.PlaneGeometry(width*1.9,32),shadow.material.clone());
    stageShadow.rotation.x=-Math.PI/2;
    stageShadow.visible=false;
    scene.add(stageShadow);
    return {footprint,component,stageShadow};
  });

  const details=Object.fromEntries(entries.map(({key})=>{
    const object=leaf[key];
    const bounds=new THREE.Box3().setFromObject(object);
    if(bounds.isEmpty())throw new Error('Missing BOM geometry: '+key);
    const center=bounds.getCenter(new THREE.Vector3());
    const size=bounds.getSize(new THREE.Vector3());
    return [key,{object,center,size}];
  }));
  const arrangements=new Map();
  let previousDetail=null;
  const offset=new THREE.Vector3();
  const layerKeys=layers.map(layer=>layer[0]);

  function arrange(module, compact){
    const cacheKey=module+':'+compact;
    if(arrangements.has(cacheKey))return arrangements.get(cacheKey);
    const rows=bomByModule[module].filter(row=>!layerKeys.includes(row.key));
    const primary=details[rows[0].key];
    const remainder=rows.slice(1);
    const columns=Math.min(remainder.length>8?4:3,remainder.length);
    const grid=Array.from({length:Math.ceil(remainder.length/columns)},(_,i)=>
      remainder.slice(i*columns,i*columns+columns));
    const scale=Math.max(primary.size.x,primary.size.y);
    const gap=compact?Math.max(3.5,Math.min(9,scale*.137)):Math.max(3.5,scale*.22);
    const widths=Array.from({length:columns},(_,i)=>
      Math.max(gap*(compact?1.45:1.8),...grid.map(row=>row[i]?details[row[i].key].size.x:0)));
    const heights=grid.map(row=>Math.max(gap*(compact?1.28:1.75),...row.map(item=>details[item.key].size.y)));
    const gridWidth=widths.reduce((a,b)=>a+b,0)+(columns-1)*gap;
    const gridHeight=heights.reduce((a,b)=>a+b,0)+(grid.length-1)*gap;
    const result={};
    const wholeWidth=compact?Math.max(gridWidth,primary.size.x):primary.size.x+gap+gridWidth;
    const wholeHeight=compact?primary.size.y+gap+gridHeight:Math.max(primary.size.y,gridHeight);
    result[rows[0].key]=new THREE.Vector3(compact?0:(primary.size.x-wholeWidth)/2,
      compact?(wholeHeight-primary.size.y)/2:0,0);
    let y=compact?wholeHeight/2-primary.size.y-gap:gridHeight/2;
    for(const [rowIndex,row] of grid.entries()){
      let x=compact?-gridWidth/2:-wholeWidth/2+primary.size.x+gap;
      for(const [col,item] of row.entries()){
        const z=item.key==='io-port'?6:rowIndex%2===0?4:0;
        result[item.key]=new THREE.Vector3(x+widths[col]/2,y-heights[rowIndex]/2,z);
        x+=widths[col]+gap;
      }
      y-=heights[rowIndex]+gap;
    }
    arrangements.set(cacheKey,result);
    return result;
  }
  function setDetail(module, amount, selectedItem, compact, stack){
    if(previousDetail&&previousDetail!==module){
      for(const item of bomByModule[previousDetail]){
        const object=details[item.key].object;
        object.position.set(0,0,0);
        object.rotation.set(0,0,0);
        object.visible=true;
      }
    }
    previousDetail=module;
    if(!stack)for(const key of layerKeys)leaf[key].visible=false;
    if(!module)return;
    if(stack){
      for(const row of bomByModule.logic){
        const object=leaf[row.key], index=layerKeys.indexOf(row.key);
        object.visible=index!==-1&&(!selectedItem||row.key===selectedItem);
        const x=compact?(index%2-.5)*58:(index-1.5)*61;
        const y=compact?(.5-Math.floor(index/2))*86:(1.5-index)*5;
        object.rotation.set(-.20*amount,0,0);
        object.position.set(x*amount,y*amount,(1.5-index)*11*amount);
      }
      return;
    }
    const arrangement=arrange(module,compact);
    const travel=amount*amount*(3-2*amount);
    for(const item of bomByModule[module]){
      if(layerKeys.includes(item.key))continue;
      const {object,center}=details[item.key];
      object.rotation.set(.035*travel,item.key==='io-port'?Math.PI*travel:0,.018*travel);
      offset.copy(center).applyQuaternion(object.quaternion);
      object.position.copy(arrangement[item.key]).multiplyScalar(travel)
        .addScaledVector(center,1-travel).sub(offset);
      object.visible=!selectedItem||item.key===selectedItem;
    }
  }
  return {root,parts,anchors,eye,setPose,setDetail,details,environment};
}
