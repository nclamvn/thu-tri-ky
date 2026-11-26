import {byId,modules} from './viewer/assembly-data.js?v=a0cc1c2d1068';
import {bomByKey,bomByModule} from './viewer/bom-data.js?v=a0cc1c2d1068';
import {layers} from './viewer/simulation-data.js?v=a0cc1c2d1068';

const id=name=>document.getElementById(name);
const hero=id('product-hero');
const model=id('model');
const backIntro=id('back-intro');
const still=id('model-still');
const slider=id('travel');
const controls=Array.from(document.querySelectorAll('button[data-view]'));
const panel=id('component-panel');
const list=id('component-list');
const views={
  front:{camera:'front',amount:0,image:'./media/front.webp?v=a0cc1c2d1068',alt:'Tri Kỷ nhìn chính diện'},
  rear:{camera:'rear',amount:0,image:'./media/rear.webp?v=a0cc1c2d1068',alt:'Vỏ sau với cụm lỗ loa'},
  exploded:{camera:'angle',amount:1,image:'./media/exploded.webp?v=a0cc1c2d1068',alt:'Các cấu kiện Tri Kỷ ở góc phân rã'},
};
const state={view:'front',amount:0,part:null,layer:0,item:null,isolated:false};
const copperKeys=new Set(layers.map(([key])=>key));
let viewer,renderedList,renderedPanel;

function componentButton(key,title,ref,select){
  const row=document.createElement('li');
  const button=document.createElement('button');
  button.type='button';
  button.className='text-action';
  button.dataset.key=key;
  if(ref){
    const code=document.createElement('span');
    code.className='component-code';
    code.textContent=ref;
    button.append(code,' ');
  }
  button.append(title);
  button.addEventListener('click',()=>{
    select(key);
    if(viewer&&select===selectItem)model.scrollIntoView({block:'start'});
    else id(select===selectItem?'component-readout':'component-title').scrollIntoView({block:'nearest'});
  });
  row.append(button);
  return row;
}

function renderPanel(){
  const visible=!!state.part||state.view==='exploded';
  const nextPanel=JSON.stringify([visible,state.part,state.item,state.isolated]);
  if(nextPanel===renderedPanel)return;
  renderedPanel=nextPanel;
  const part=byId[state.part];
  const item=bomByKey[state.item];
  panel.hidden=!visible;
  id('back-model').hidden=!part;
  id('component-title').textContent=part?part.name:'Các cụm linh kiện';
  id('component-readout').hidden=!item;
  id('show-group').hidden=!state.isolated;
  if(item){
    id('component-ref').textContent=item.ref+' · '+item.qty+' '+item.unit.toLocaleLowerCase('vi');
    id('component-name').textContent=item.name;
    id('component-purpose').textContent=item.purpose;
  }
  if(renderedList!==state.part){
    renderedList=state.part;
    const rows=part
      ?bomByModule[part.id].map(row=>componentButton(row.key,row.name,row.ref,selectItem))
      :modules.map(row=>componentButton(row.id,row.name,'',selectPart));
    list.replaceChildren(...rows);
  }
  for(const button of list.querySelectorAll('button')){
    if(part)button.setAttribute('aria-pressed',String(button.dataset.key===state.item));
  }
}

function render(){
  const stack=copperKeys.has(state.item);
  const value=Math.round(100*(state.part?state.layer:state.amount));
  if(model.dataset.webgl!=='live'){
    const {image,alt}=views[state.view];
    if(still.getAttribute('src')!==image)still.src=image;
    still.alt=alt;
  }
  slider.disabled=!viewer;
  slider.value=String(value);
  id('travel-label').textContent=stack?'Tách lớp đồng':state.part?'Tách linh kiện':'Độ tách lớp';
  id('travel-value').textContent=value+'%';
  model.dataset.amount=String(value);
  model.dataset.part=state.part||'';
  model.dataset.item=state.item||'';
  model.dataset.isolated=String(state.isolated);
  for(const button of controls){
    button.setAttribute('aria-pressed',String(!state.part&&button.dataset.view===state.view));
  }
  viewer?.setState({amount:state.amount,layer:state.layer,part:state.part||'face',
    isolated:state.isolated,links:false,mood:'idle',detail:!!state.part,stack,item:state.item});
  renderPanel();
}

function show(view){
  Object.assign(state,{view,amount:views[view].amount,part:null,item:null,isolated:false});
  render();
  viewer?.setCamera(views[view].camera);
}

function enterExplore(){
  if(hero.hasAttribute('data-exploring'))return;
  hero.setAttribute('data-exploring','');
  id('intro').hidden=true;
  backIntro.hidden=false;
  model.scrollIntoView({block:'start'});
}

function leaveExplore(){
  show('front');
  hero.removeAttribute('data-exploring');
  id('intro').hidden=false;
  backIntro.hidden=true;
  hero.scrollIntoView({block:'start'});
  id('intro').querySelector('a').focus({preventScroll:true});
}

function selectPart(key){
  if(!byId[key])return;
  enterExplore();
  Object.assign(state,{part:key,item:null,isolated:false,layer:key==='logic'?0:1});
  render();
  viewer?.setCamera('angle');
}

function selectItem(key){
  const item=bomByKey[key];
  if(!item||item.module!==state.part)return;
  state.item=key;
  state.isolated=key!=='logic-pcb';
  if(copperKeys.has(key))state.layer=1;
  if(key==='logic-pcb')state.layer=0;
  render();
}

for(const button of controls)button.addEventListener('click',()=>{
  enterExplore();
  show(button.dataset.view);
});
backIntro.addEventListener('click',leaveExplore);
model.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&hero.hasAttribute('data-exploring'))leaveExplore();
});
slider.addEventListener('input',()=>{
  enterExplore();
  const value=Number(slider.value)/100;
  if(state.part){
    state.layer=value;
    state.isolated=false;
  }else{
    state.amount=value;
    if(value>0)state.view='exploded';
    else if(state.view==='exploded')state.view='front';
  }
  render();
});
id('show-group').addEventListener('click',()=>{
  state.isolated=false;
  if(copperKeys.has(state.item)){state.item=null;state.layer=0;}
  render();
  id('travel').focus();
});
id('back-model').addEventListener('click',()=>{
  Object.assign(state,{part:null,item:null,isolated:false});
  render();
  viewer?.setCamera(views[state.view].camera);
  controls.find(button=>button.dataset.view===state.view).focus({preventScroll:true});
});

function fallback(){
  viewer=null;
  model.dataset.webgl='fallback';
  id('motion-note').hidden=true;
  id('model-status').textContent='Đang xem ảnh. Danh mục linh kiện vẫn mở được.';
  render();
}
try{
  const {createViewer}=await import('./viewer/hardware-view.js?v=a0cc1c2d1068');
  viewer=createViewer(id('viewer'),id('viewer-markers'),{
    select:selectPart,item:selectItem,cameraChanged(){},unavailable:fallback,
    interacted:enterExplore,
    rendered({triangles,population}){
      if(triangles>0&&model.dataset.webgl==='loading')model.dataset.webgl='live';
      model.dataset.population=String(population);
    },
  });
  render();
  viewer.setCamera(views[state.view].camera);
}catch{
  fallback();
}
