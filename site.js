const section=document.getElementById('model');
const still=document.getElementById('model-still');
const status=document.getElementById('model-status');
const motion=document.getElementById('motion-note');
const buttons=Array.from(document.querySelectorAll('button[data-view]'));
const states={
  front:{camera:'front',amount:0,alt:'Tri Kỷ nhìn chính diện'},
  rear:{camera:'rear',amount:0,alt:'Vỏ sau với cụm lỗ loa'},
  exploded:{camera:'angle',amount:1,alt:'Các cấu kiện Tri Kỷ ở góc phân rã'},
};
let viewer,current='front';

function show(view) {
  const {camera,amount,alt}=states[view];
  current=view;
  still.src=`./media/${view}.webp`;
  still.alt=alt;
  if(viewer){
    viewer.setState({amount,layer:0,part:amount?'logic':'face',isolated:false,
      links:false,mood:'idle',detail:false,stack:false,item:null});
    viewer.setCamera(camera);
  }
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.view===view));
}
function fallback(){
  viewer=null;
  section.dataset.webgl='fallback';
  motion.hidden=true;
  status.textContent='Đang xem ảnh của mô hình.';
}
for(const button of buttons)button.addEventListener('click',()=>show(button.dataset.view));
try{
  const {createViewer}=await import('./viewer/hardware-view.js');
  viewer=createViewer(document.getElementById('viewer'),document.getElementById('viewer-markers'),{
    select(){}, item(){}, cameraChanged(){}, unavailable:fallback,
    rendered({triangles}){
      if(triangles>0&&section.dataset.webgl==='loading')section.dataset.webgl='live';
    },
  });
  show(current);
}catch{
  fallback();
}
