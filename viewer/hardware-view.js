import * as THREE from './three/three.module.js?v=a0cc1c2d1068';
import {makeAssembly} from './hardware.js?v=a0cc1c2d1068';
import {modules} from './assembly-data.js?v=a0cc1c2d1068';
import {bomByModule, entries} from './bom-data.js?v=a0cc1c2d1068';
import {layers} from './simulation-data.js?v=a0cc1c2d1068';

const touchLimit=6;
const copperKeys=new Set(layers.map(([key])=>key));
const presets={front:[0,0], angle:[.21,.15], rear:[Math.PI-.32,.15]};
const boardPresets={front:[0,0],angle:[.36,.21],side:[Math.PI/2,0],rear:[Math.PI,0]};
const faces={
  idle:{open:.96,smile:.08,gazeX:0,gazeY:0,strength:.93,dim:0},
  alert:{open:1.03,smile:0,gazeX:0,gazeY:-1,strength:.98,dim:0},
  amused:{open:.89,smile:.42,gazeX:3,gazeY:0,strength:.99,dim:0},
  smile:{open:.59,smile:.95,gazeX:3,gazeY:-1,strength:1,dim:0},
  pause:{open:.84,smile:.22,gazeX:0,gazeY:1,strength:.92,dim:.18},
  sulky:{open:.32,smile:.42,gazeX:-7,gazeY:5,strength:.84,dim:.72},
};

export function createViewer(host, markerLayer, callbacks) {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NeutralToneMapping;
  renderer.toneMappingExposure=1.04;
  const scene=new THREE.Scene();
  const orthographic=new THREE.OrthographicCamera(-100,100,100,-100,.1,1500);
  const perspective=new THREE.PerspectiveCamera(35,1,1,1500);
  let camera=orthographic;
  const model=makeAssembly(renderer,scene);
  const canvas=renderer.domElement;
  canvas.className='assembly-canvas';
  canvas.setAttribute('aria-hidden','true');
  host.prepend(canvas);

  const motion=matchMedia('(prefers-reduced-motion:reduce)');
  const markers=new Map();
  const labelMarker=(key, label, name, select, fine)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=fine?'locator ref':'locator';
    button.textContent=label;
    button.setAttribute('aria-label','Chọn '+name.toLowerCase());
    button.title=name;
    button.hidden=true;
    button.addEventListener('click',()=>select(key));
    markerLayer.append(button);
    markers.set(key,button);
  };
  const moduleKeys=modules.map(part=>part.id);
  for(const [index,part] of modules.entries()){
    labelMarker(part.id,String(index+1).padStart(2,'0'),part.name,callbacks.select,false);
  }
  for(const item of entries)labelMarker(item.key,item.ref,item.name,callbacks.item,true);

  const desired={amount:1,layer:1,yaw:.21,pitch:.15,zoom:1};
  const actual={...desired};
  let selected='logic', isolated=false, links=false, mood='idle';
  let detail=false, stack=false, item=null;
  let requested=0, needsDraw=true, visible=true, stopped=false, last=0, lastPaint=0;
  let hasRendered=false;
  let width=0,height=0,compact=false;
  const activeFace={...faces.idle};
  const eyeScratch={...activeFace};
  const target=new THREE.Vector3(0,65,0), targetGoal=new THREE.Vector3(), point=new THREE.Vector3();
  const focus=new THREE.Box3(), size=new THREE.Vector3(), direction=new THREE.Vector3();
  const board=model.parts.logic;
  const boardSize=new THREE.Box3().setFromObject(board).getSize(new THREE.Vector3());
  const boardQuaternion=new THREE.Quaternion();
  const boardOrbitDistance=boardSize.y*2.25;
  const boardRadius=boardSize.length()/2;
  const boardHalfWidth=Math.hypot(boardSize.x,boardSize.z)/2;
  const closestHorizontalPlane=boardOrbitDistance-boardSize.y/2*Math.sin(.69);
  const boardFrameHeight=2*boardOrbitDistance*boardRadius/Math.sqrt(boardOrbitDistance**2-boardRadius**2);
  const boardFrameWidth=2*boardOrbitDistance*boardHalfWidth/Math.sqrt(closestHorizontalPlane**2-boardHalfWidth**2);
  const ray=new THREE.Raycaster(), pointerNdc=new THREE.Vector2();
  let fitted=0;
  let nextBlink=performance.now()+4100, blinkStarted=-1000;
  const contacts=new Map();
  let gesture=null;

  function wake(){
    needsDraw=true;
    if (!requested && visible && !document.hidden && !stopped) requested=requestAnimationFrame(frame);
  }
  function sizeCanvas() {
    const initial=width===0;
    width=host.clientWidth;height=host.clientHeight;
    if(!width||!height)return;
    compact=width<680;
    if(initial&&compact){desired.yaw=actual.yaw=.11;desired.pitch=actual.pitch=.10;}
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,compact?1.55:1.8,Math.sqrt((compact?900000:1600000)/(width*height))));
    renderer.setSize(width,height,false);
    wake();
  }
  const observeSize=new ResizeObserver(sizeCanvas);
  const observeVisibility=new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;
    if(visible)wake();else pause();
  });
  observeSize.observe(host);
  observeVisibility.observe(host);
  function pause(){cancelAnimationFrame(requested);requested=0;last=0;}
  function onVisibility(){if(document.hidden)pause();else wake();}
  document.addEventListener('visibilitychange',onVisibility);
  motion.addEventListener('change',wake);
  const inspectingBoard=()=>selected==='logic'&&!stack&&(detail?!isolated:isolated);

  function layoutMarkers() {
    const occupied=[];
    const currentKeys=detail?bomByModule[selected].map(part=>part.key):moduleKeys;
    const emphasis=detail?item:selected;
    const byPriority=emphasis?[emphasis,...currentKeys.filter(key=>key!==emphasis)]:currentKeys;
    for(const [key,button] of markers)if(!currentKeys.includes(key))button.hidden=true;
    for(const id of byPriority) {
      const button=markers.get(id);
      if((detail?actual.layer<.52:actual.amount<.63)||isolated||!width||!height||
        (detail&&!stack&&copperKeys.has(id))||
        (detail&&!model.details[id].object.visible)){button.hidden=true;continue;}
      if(detail){
        const leaf=model.details[id];
        point.copy(leaf.center);
        point.y+=leaf.size.y/2;
        leaf.object.localToWorld(point).project(camera);
      } else {
        const component=model.parts[id];
        point.copy(model.anchors[id]).applyQuaternion(component.quaternion).add(component.position).project(camera);
      }
      const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
      // Move the identifier above its anchor and avoid stacking dense marks on mobile.
      const bx=x,by=y-(detail?13:22);
      const radius=detail?31:19;
      const room=bx>=radius && bx<=width-radius && by>=19 && by<=height-25;
      const clear=occupied.every(([u,v])=>Math.hypot(bx-u,by-v)>(detail?43:31));
      button.hidden=!(room && clear);
      if(button.hidden)continue;
      occupied.push([bx,by]);
      button.style.transform='translate('+Math.round(bx)+'px,'+Math.round(by)+'px) translate(-50%,-50%)';
      button.dataset.selected=String(id===emphasis);
    }
  }

  function frame(now) {
    requested=0;
    if (stopped || !visible || document.hidden || !width || !height) return;
    const reduced=motion.matches;
    const delta=Math.min(.07,(now-(last||now))/1000);
    last=now;
    const rate=reduced?1:1-Math.exp(-delta*12);
    if(!hasRendered)Object.assign(actual,desired);
    let moving=false;
    function move(from,to,epsilon=.001){
      if(Math.abs(to-from)<=epsilon)return to;
      moving=true;
      return THREE.MathUtils.lerp(from,to,rate);
    }
    for(const key of Object.keys(actual)){
      const diff=key==='amount'?.0005:.001;
      actual[key]=move(actual[key],desired[key],diff);
    }
    const aspect=width/height;
    if(needsDraw||moving){
      model.setPose(detail?0:actual.amount,(detail||isolated)?selected:null,links&&!detail,selected,compact);
      model.setDetail(detail?selected:null,actual.layer,isolated?item:null,compact,stack);
    }
    const frontHeight=Math.max(156,109/aspect);
    const spreadHeight=compact?Math.max(324,232/aspect):Math.max(194,427/aspect);
    let worldHeight=THREE.MathUtils.lerp(frontHeight,spreadHeight,actual.amount);
    targetGoal.set(actual.amount*(compact?0:6),THREE.MathUtils.lerp(62,compact?29:59,actual.amount),0);
    const assembledBoard=inspectingBoard()&&(!detail||actual.layer===0);
    if(assembledBoard){
      // Keep the field of view fixed during orbit and allow for the nearer corners.
      board.updateWorldMatrix(true,false);
      targetGoal.setFromMatrixPosition(board.matrixWorld);
      worldHeight=1.04*Math.max(boardFrameHeight,boardFrameWidth/aspect);
    }else if(detail || (isolated&&selected)){
      const subject=model.parts[selected];
      subject.updateWorldMatrix(true,true);
      if(detail){
        focus.makeEmpty();
        for(const {key} of bomByModule[selected]){
          const {object}=model.details[key];
          if(object.visible)focus.expandByObject(object);
        }
      }else focus.setFromObject(subject);
      focus.getCenter(targetGoal);
      focus.getSize(size);
      worldHeight=detail?Math.max(9,Math.max(size.y+size.z*.45,(size.x+size.z*.56)/aspect)*1.27)
        :Math.max(23,size.length()*1.15/Math.min(1,aspect));
    }
    fitted=move(fitted||worldHeight,worldHeight,.045);
    if(hasRendered){
      target.set(move(target.x,targetGoal.x,.04),move(target.y,targetGoal.y,.04),move(target.z,targetGoal.z,.04));
    }else target.copy(targetGoal);
    camera=assembledBoard?perspective:orthographic;
    const half=fitted*.5;
    if(assembledBoard){
      perspective.aspect=aspect;
      perspective.fov=THREE.MathUtils.radToDeg(2*Math.atan(half/boardOrbitDistance));
      perspective.zoom=actual.zoom;
    }else{
      const zoomedHalf=half/actual.zoom;
      orthographic.left=-zoomedHalf*aspect;orthographic.right=zoomedHalf*aspect;
      orthographic.top=zoomedHalf;orthographic.bottom=-zoomedHalf;
    }
    direction.set(Math.sin(actual.yaw)*Math.cos(actual.pitch),Math.sin(actual.pitch),Math.cos(actual.yaw)*Math.cos(actual.pitch));
    camera.up.set(0,1,0);
    if(assembledBoard){
      board.getWorldQuaternion(boardQuaternion);
      direction.applyQuaternion(boardQuaternion);
      camera.up.applyQuaternion(boardQuaternion);
    }
    camera.position.copy(target).addScaledVector(direction,assembledBoard?boardOrbitDistance:460);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const mask=actual.amount<.16&&!isolated&&!detail?1-actual.amount/.16:0;
    const alive=mask>.02 && !reduced;
    if(alive && now>=nextBlink){
      blinkStarted=now;
      nextBlink=now+3950;
    }
    const blink=alive && now-blinkStarted<245 ? .96*Math.sin(Math.PI*(now-blinkStarted)/245)**2 : 0;
    let textureChanged=false;
    const eyeGoal=faces[mood]||faces.idle;
    if(needsDraw || moving || alive){
      for(const key of Object.keys(activeFace))activeFace[key]=move(activeFace[key],eyeGoal[key],.006);
      for(const key of Object.keys(activeFace))eyeScratch[key]=activeFace[key];
      eyeScratch.open=(eyeScratch.open+(alive?Math.sin(now/765)*.023:0))*(1-blink);
      eyeScratch.gazeX+=alive?Math.sin(now/880)*1.9:0;
      eyeScratch.strength*=mask;
      textureChanged=model.eye.paint(eyeScratch);
    }
    if(needsDraw || moving || textureChanged){
      renderer.render(scene,camera);
      hasRendered=true;
      layoutMarkers();
      const population=selected==='logic'&&detail?bomByModule.logic.reduce((total,row)=>{
        const populated=row.key==='logic-passives'||row.unit==='Linh kiện'||row.unit==='Đầu nối';
        return total+(populated&&model.details[row.key].object.visible?row.qty:0);
      },0):0;
      callbacks.rendered?.({...renderer.info.render,population});
      needsDraw=false;
      lastPaint=now;
    }
    // Idle faces can blink. A static exploded assembly consumes no render loop.
    if(moving || needsDraw || alive)requested=requestAnimationFrame(next=>{
      if(!needsDraw && next-lastPaint<27) {
        requested=requestAnimationFrame(frame);
      } else frame(next);
    });
  }

  function orbit(yaw,pitch) {
    desired.yaw=yaw;desired.pitch=THREE.MathUtils.clamp(pitch,-.68,.69);
    wake();
  }
  function zoomBy(factor){desired.zoom=THREE.MathUtils.clamp(desired.zoom*factor,.65,2.8);wake();}
  function pick(event){
    const bounds=canvas.getBoundingClientRect();
    pointerNdc.set((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2);
    ray.setFromCamera(pointerNdc,camera);
    for(const match of ray.intersectObject(model.root,true)){
      let object=match.object;
      while(object&&!object.userData.part&&!object.userData.item)object=object.parent;
      if(object?.userData.item){
        if(!object.visible||!object.parent.visible)continue;
        if(detail) {
          const key=object.userData.item;
          callbacks.item(!stack&&copperKeys.has(key)?'logic-pcb':key);
        }
        else callbacks.select(object.parent.userData.part);
        return;
      }
      if(object?.visible&&object.userData.part&&!detail){callbacks.select(object.userData.part);return;}
    }
  }
  function spacing(){
    const [a,b]=contacts.values();
    return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;
  }
  function startDrag(id,{x,y},moved=false){
    const angles=inspectingBoard()?actual:desired;
    gesture={id,x,y,yaw:angles.yaw,pitch:angles.pitch,moved};
  }
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0 || contacts.size>=2)return;
    contacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
    if(contacts.size===1)startDrag(event.pointerId,contacts.get(event.pointerId));
    else gesture={distance:spacing(),zoom:desired.zoom,moved:true};
  });
  canvas.addEventListener('pointermove',event=>{
    if(!contacts.has(event.pointerId))return;
    contacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(gesture?.distance>0&&contacts.size===2){
      desired.zoom=THREE.MathUtils.clamp(gesture.zoom*spacing()/gesture.distance,.65,2.8);
      wake();
      callbacks.interacted?.();
      return;
    }
    if(gesture?.id!==event.pointerId)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.moved&&Math.hypot(dx,dy)>touchLimit){
      gesture.moved=true;
      if(event.pointerType!=='touch'||Math.abs(dx)>Math.abs(dy))callbacks.interacted?.();
    }
    if(gesture.moved){
      const boardOrbit=inspectingBoard();
      const yawPerPixel=boardOrbit?Math.PI/Math.max(260,width*.68):.009;
      const pitchPerPixel=boardOrbit?Math.PI*.59/Math.max(320,height):.005;
      orbit(gesture.yaw-dx*yawPerPixel,gesture.pitch+dy*pitchPerPixel);
      // Keep the rendered angles attached to the pointer when the drag reverses.
      if(boardOrbit){
        actual.yaw=desired.yaw;
        actual.pitch=desired.pitch;
      }
      callbacks.cameraChanged('free');
    }
  });
  function finish(event) {
    if(!contacts.delete(event.pointerId))return;
    const tapped=contacts.size===0&&gesture?.id===event.pointerId&&!gesture.moved&&event.type==='pointerup';
    if(contacts.size===1&&gesture?.distance>0){
      const [id,position]=contacts.entries().next().value;
      startDrag(id,position,true);
    }else if(contacts.size===0)gesture=null;
    if(tapped)pick(event);
  }
  canvas.addEventListener('pointerup',finish);
  canvas.addEventListener('pointercancel',finish);
  canvas.addEventListener('lostpointercapture',finish);
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();
    const delta=THREE.MathUtils.clamp(event.deltaY,-150,150);
    zoomBy(Math.exp(-delta*.0016));
    if(delta!==0)callbacks.interacted?.();
  },{passive:false});
  host.addEventListener('keydown',event=>{
    if(event.target!==host)return;
    const arrows={ArrowLeft:[.16,0],ArrowRight:[-.16,0],ArrowUp:[0,.10],ArrowDown:[0,-.10]};
    if(arrows[event.key]){
      event.preventDefault();
      orbit(desired.yaw+arrows[event.key][0],desired.pitch+arrows[event.key][1]);
      callbacks.cameraChanged('free');
      callbacks.interacted?.();
    }else if(['+','-','=','Home'].includes(event.key)){
      event.preventDefault();
      if(event.key==='Home'){
        setCamera('front');
        callbacks.cameraChanged('front');
      }else zoomBy(event.key==='-'?.86:1.16);
      callbacks.interacted?.();
    }
  });
  function setCamera(preset,boardView=inspectingBoard(),keepZoom=false){
    const [yaw,pitch]=boardView?boardPresets[preset]
      :preset==='angle'&&compact?[.11,.10]:(presets[preset]||presets.front);
    if(!keepZoom)desired.zoom=1;
    const gap=yaw-actual.yaw;
    orbit(actual.yaw+Math.atan2(Math.sin(gap),Math.cos(gap)),pitch);
  }
  function stop(){
    stopped=true;
    pause();
    observeSize.disconnect();observeVisibility.disconnect();
    document.removeEventListener('visibilitychange',onVisibility);
    motion.removeEventListener('change',wake);
    for(const marker of markers.values())marker.hidden=true;
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();callbacks.unavailable();});
  sizeCanvas();

  return {
    setState(state){
      desired.amount=state.amount;
      desired.layer=state.layer;
      selected=state.part;
      isolated=state.isolated;
      links=state.links;
      mood=state.mood;
      detail=state.detail;
      stack=state.stack;
      item=state.item;
      wake();
    },
    setCamera,
    zoomBy,
    stop,
  };
}
