// Appearance-section datums in millimetres. Height, half-width, front, rear.
export const baseSeam=3.25;
export const crown=123.8;
export const shellSplit=1.40;
export const wallThickness=1.65;
export const lensStart=[0,120.5];
export const lensCurves=[
  [-18.8,120.5,-27.4,103,-30.6,84],
  [-33.9,66.5,-34.2,55.2,-25.8,52.1],
  [-18.2,48.6,-7.5,48.7,0,48.7],
  [7.5,48.7,18.2,48.6,25.8,52.1],
  [34.2,55.2,33.9,66.5,30.6,84],
  [27.4,103,18.8,120.5,0,120.5],
];
const sections=[
  [baseSeam,25.2,14.2,-13.8],
  [12,30.0,17.0,-18.0],
  [28,34.1,19.5,-21.0],
  [49,36.3,20.25,-22.0],
  [65,36.7,20.5,-21.9],
  [82,35.7,20.5,-20.5],
  [101,30.6,20.2,-16.8],
  [112,23.9,19.6,-11.3],
  [118,16.8,18.8,-5.3],
  [121,11.4,17.8,-.6],
];
const last=sections.at(-1);
const crownCenter=10.5;

function sectionSlope(i,axis) {
  if(i===sections.length-1){
    const depth=(last[2]-last[3])/2;
    const mid=(last[2]+last[3])/2;
    const centerSlope=(crownCenter-mid)/(crown-last[0]);
    const radiusSlope=1/(2*(crown-last[0]));
    return axis===1?-last[1]*radiusSlope:centerSlope+(axis===2?-1:1)*depth*radiusSlope;
  }
  const a=sections[Math.max(0,i-1)],b=sections[i+1];
  return (b[axis]-a[axis])/(b[0]-a[0]);
}

export function shellSection(y) {
  if(y>=last[0]){
    const heightRatio=Math.max(0,(crown-y)/(crown-last[0]));
    const scale=Math.sqrt(heightRatio);
    const center=crownCenter+((last[2]+last[3])/2-crownCenter)*heightRatio;
    const depth=(last[2]-last[3])/2*scale;
    return [last[1]*scale,center+depth,center-depth];
  }
  if(y<=baseSeam)return sections[0].slice(1);
  const i=sections.findIndex(section=>section[0]>y)-1;
  const a=sections[i],b=sections[i+1],span=b[0]-a[0],t=(y-a[0])/span;
  const u=1-t;
  return [1,2,3].map(axis=>
    (1+2*t)*u*u*a[axis]+t*u*u*span*sectionSlope(i,axis)+
    t*t*(3-2*t)*b[axis]-t*t*u*span*sectionSlope(i+1,axis));
}

function sectionZ(cosine,front,rear) {
  const contour=cosine>=0?1-(1-cosine)**2.95:((1+cosine)**2.85)-1;
  return (front+rear)/2+(front-rear)/2*contour;
}

export function shellPoint(angle,y,inset=0) {
  const [width,front,rear]=shellSection(y);
  const wall=Math.min(inset,width*.55);
  return [(width-wall)*Math.sin(angle),y,sectionZ(Math.cos(angle),front-wall,rear+wall)];
}

export function frontSurface(x,y) {
  const [width,front,rear]=shellSection(y);
  const ratio=width?Math.min(1,Math.abs(x)/width):0;
  return sectionZ(Math.sqrt(1-ratio*ratio),front,rear);
}

export function rearSurface(x,y,inset=0) {
  const [width]=shellSection(y);
  const ratio=Math.min(1,Math.abs(x)/(width-Math.min(inset,width*.55)));
  return shellPoint(Math.PI-Math.asin(ratio),y,inset)[2];
}

export const rearGrille={
  columns:13,
  rows:[7,11,13,11,7],
  centerY:29,
  anglePitch:.073,
  rowPitch:2.45,
  holeRadius:.44,
};
rearGrille.angleStart=Math.PI-rearGrille.columns/2*rearGrille.anglePitch;
rearGrille.yStart=rearGrille.centerY-rearGrille.rows.length/2*rearGrille.rowPitch;
