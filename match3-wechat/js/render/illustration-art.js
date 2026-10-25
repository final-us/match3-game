'use strict';
const assets = require('./assets');
const type = require('./typography');
const theme = require('./theme');
const material = require('./button-material');
const SERIF = '"Songti SC","STSong","Noto Serif CJK SC",Georgia,serif';
const itemCells = { freeze: 0, disturb: 1, reflect: 2, cheer: 3, hammer: 4, bomb: 5, color: 6 };

function drawCell(ctx, image, index, columns, rows, x, y, size) {
    if (!image || !image.width || !image.height) return false;
    const width = image.width / columns, height = image.height / rows;
    ctx.drawImage(image, index % columns * width, Math.floor(index / columns) * height,
        width, height, x, y, size, size);
    return true;
}
function drawItem(ctx, key, x, y, size) {
    if (!Object.prototype.hasOwnProperty.call(itemCells, key)) return false;
    return drawCell(ctx, assets.get('uiIllustrationItems'), itemCells[key], 4, 2, x, y, size);
}
function drawChest(ctx, index, x, y, size) {
    if (!Number.isInteger(index) || index < 0 || index > 2) return false;
    return drawCell(ctx, assets.get('uiIllustrationChests'), index, 3, 1, x, y, size);
}

// Keep the arched crown and flowered base intact while extending the quiet middle.
function drawFrame(ctx, x, y, width, height) {
    const image = assets.get('uiResultFrame');
    if (!image || !image.width || !image.height || width <= 0 || height <= 0) return false;
    const sw = image.width, sh = image.height;
    const sx = [0, sw * .24, sw * .76, sw], sy = [0, sh * .27, sh * .70, sh];
    const scale = Math.min(width / sw, height / sh);
    const dx = [x, x + sx[1] * scale, x + width - (sw - sx[2]) * scale, x + width];
    const dy = [y, y + sy[1] * scale, y + height - (sh - sy[2]) * scale, y + height];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            ctx.drawImage(image, sx[col], sy[row], sx[col + 1] - sx[col], sy[row + 1] - sy[row],
                dx[col], dy[row], dx[col + 1] - dx[col], dy[row + 1] - dy[row]);
        }
    }
    return true;
}
function rounded(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// The new skin has a flat paper body, not the result card's stage. Keep its
// title, flower corners and ribbons at their original aspect while extending paper.
function paperFrame(ctx, x, y, w, h, capScale) {
    const img = assets.get('uiIllustrationFrame');
    if (img && img.width && img.height && w > 0 && h > 0) {
        const edge=capScale ? .30 : .14;
        const sx=[0,img.width*edge,img.width*(1-edge),img.width];
        const sy=[0,img.height*.18,img.height*.82,img.height];
        const scale=Math.min(w/img.width,h/(img.height*.4))*(capScale||1);
        const dx=[x,x+sx[1]*scale,x+w-(img.width-sx[2])*scale,x+w];
        const dy=[y,y+sy[1]*scale,y+h-(img.height-sy[2])*scale,y+h];
        for(let row=0;row<3;row++)for(let col=0;col<3;col++){
            ctx.drawImage(img,sx[col],sy[row],sx[col+1]-sx[col],sy[row+1]-sy[row],
                dx[col],dy[row],dx[col+1]-dx[col],dy[row+1]-dy[row]);
        }
        paperGleam(ctx,x,y,w,h,scale);
        return true;
    }
    ctx.save();
    const g=ctx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,'#FFF9EC');g.addColorStop(.55,'#FFF7E7');g.addColorStop(1,'#F5E6D4');
    ctx.fillStyle=g;rounded(ctx,x+8,y+8,w-16,h-16,24);ctx.fill();
    ctx.strokeStyle='#D3A05F';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#FFF3C8';ctx.lineWidth=1;rounded(ctx,x+12,y+12,w-24,h-24,20);ctx.stroke();
    ctx.restore();return false;
}

// These accents track the source frame's rails, not its responsive paper area.
// No extra rectangle crosses the illustrated flowers or the arched title.
function paperGleam(ctx,x,y,w,h,scale) {
    ctx.save();ctx.lineCap='round';
    const left=x+36*scale,right=x+w-36*scale;
    const top=y+145*scale,bottom=y+h-128*scale;
    if(bottom>top)for(const [px,reverse] of [[left,false],[right,true]]){
        const g=ctx.createLinearGradient(px,top,px,bottom);
        [[0,0],[.16,reverse?.12:.9],[.37,reverse?.8:.08],[.68,reverse?.1:.7],[1,0]].forEach(([p,a])=>g.addColorStop(p,'rgba(255,249,210,'+a+')'));
        ctx.strokeStyle=g;ctx.lineWidth=Math.max(.7,1.6*scale);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();
    }
    const by=y+h-58*scale,g=ctx.createLinearGradient(x+w*.20,by,x+w*.80,by);
    g.addColorStop(0,'rgba(255,250,214,0)');g.addColorStop(.28,'#FFF9D7');g.addColorStop(.65,'#FFE7A2');g.addColorStop(1,'rgba(255,250,214,0)');
    ctx.strokeStyle=g;ctx.lineWidth=Math.max(.7,1.3*scale);ctx.beginPath();ctx.moveTo(x+w*.20,by);ctx.lineTo(x+w*.80,by);ctx.stroke();
    if(scale>.4){glint(ctx,left,top+(bottom-top)*.21,3.6);glint(ctx,right,top+(bottom-top)*.73,3);}
    ctx.restore();
}
function glint(ctx,x,y,r) {
    const glow=ctx.createRadialGradient(x,y,0,x,y,r*2.6);
    glow.addColorStop(0,'rgba(255,246,189,.52)');glow.addColorStop(1,'rgba(255,246,189,0)');
    ctx.fillStyle=glow;ctx.fillRect(x-r*2.6,y-r*2.6,r*5.2,r*5.2);
    ctx.fillStyle='#FFF9D9';ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+r*.18,y-r*.15,x+r*.74,y);ctx.quadraticCurveTo(x+r*.18,y+r*.15,x,y+r);ctx.quadraticCurveTo(x-r*.18,y+r*.15,x-r*.74,y);ctx.quadraticCurveTo(x-r*.18,y-r*.15,x,y-r);ctx.fill();
}

function resultFrame(ctx,x,y,w,h) {
    const img=assets.get('uiIllustrationResultFrame');
    if(!img||!img.width||!img.height)return drawFrame(ctx,x,y,w,h)||paperFrame(ctx,x,y,w,h);
    const sx=[0,img.width*.23,img.width*.77,img.width],sy=[0,img.height*.32,img.height*.80,img.height];
    const scale=Math.min(w/img.width,h/(img.height*.58));
    const dx=[x,x+sx[1]*scale,x+w-(img.width-sx[2])*scale,x+w];
    const dy=[y,y+sy[1]*scale,y+h-(img.height-sy[2])*scale,y+h];
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)ctx.drawImage(img,sx[c],sy[r],sx[c+1]-sx[c],sy[r+1]-sy[r],dx[c],dy[r],dx[c+1]-dx[c],dy[r+1]-dy[r]);
    return true;
}

function scene(ctx,screen) {
    const img=assets.get('homeBackground');
    if(img&&img.width&&img.height){
        const scale=Math.max(screen.width/img.width,screen.height/img.height),sw=screen.width/scale,sh=screen.height/scale;
        ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,0,0,screen.width,screen.height);
    }else{
        const g=ctx.createLinearGradient(0,0,0,screen.height);g.addColorStop(0,'#253465');g.addColorStop(1,'#7587B4');
        ctx.fillStyle=g;ctx.fillRect(0,0,screen.width,screen.height);
    }
    ctx.fillStyle='rgba(17,28,70,.34)';ctx.fillRect(0,0,screen.width,screen.height);
}

function pedestal(ctx,x,y,w) {
    ctx.save();const h=w*.15;
    const g=ctx.createLinearGradient(x,y-h,x,y+h);
    g.addColorStop(0,'#FFF9EB');g.addColorStop(.45,'#FFE6AD');g.addColorStop(.7,'#D69E4C');g.addColorStop(1,'#FFF4D4');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x+w/2,y,w/2,h,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#D4A160';ctx.lineWidth=.8;ctx.stroke();
    ctx.fillStyle='#FFF9EF';ctx.beginPath();ctx.ellipse(x+w/2,y-h*.25,w*.46,h*.58,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
}

function button(ctx,x,y,w,h,label,tone,fontSize) {
    const palettes=theme.buttonPalettes;
    const colors=palettes[tone]||palettes.cream;
    ctx.save();
    ctx.shadowColor='rgba(121,71,65,.20)';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
    const fill=ctx.createLinearGradient(x,y,x,y+h);
    colors.forEach((c,i)=>fill.addColorStop([0,.32,.70,1][i],c));
    ctx.fillStyle=fill;rounded(ctx,x+1,y+1,w-2,h-2,h/2);ctx.fill();
    ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle=tone==='muted'?'#B5ACBB':'#D6A15B';ctx.lineWidth=1.5;ctx.stroke();
    rounded(ctx,x+3,y+3,w-6,h-6,h/2-3);ctx.strokeStyle='#FFF9EF';ctx.lineWidth=1.5;ctx.stroke();
    rounded(ctx,x+5,y+5,w-10,h-10,h/2-5);ctx.strokeStyle=tone==='blue'?'#5E9DE6':tone==='pink'?'#EB5D99':'#EED7B2';ctx.lineWidth=.7;ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x+h/2,y+6);ctx.lineTo(x+w-h/2,y+6);ctx.stroke();
    material.shine(ctx,x,y,w,h,tone);
    if(label){
        ctx.fillStyle=theme.buttonText[tone]||theme.buttonText.cream;
        type.drawCentered(ctx,label,x+8,y,w-16,h,{size:fontSize||18,minSize:12,weight:'bold',family:SERIF});
    }
    ctx.restore();
}

function card(ctx,x,y,w,h,selected) {
    ctx.save();const g=ctx.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,selected?'#FFFCEC':'#FFFBF4');g.addColorStop(1,selected?'#FFF0CD':'#F5E6E7');
    ctx.fillStyle=g;rounded(ctx,x,y,w,h,14);ctx.fill();
    ctx.strokeStyle=selected?'#E8B955':'#DEBCAD';ctx.lineWidth=selected?2:1;ctx.stroke();
    ctx.strokeStyle='#FFFFFF';ctx.lineWidth=1;rounded(ctx,x+3,y+3,w-6,h-6,11);ctx.stroke();ctx.restore();
}
function rule(ctx,x,y,w) {
    ctx.save();const g=ctx.createLinearGradient(x,y,x+w,y);
    g.addColorStop(0,'rgba(220,177,110,.15)');g.addColorStop(.5,'#DEB276');g.addColorStop(1,'rgba(220,177,110,.15)');
    ctx.strokeStyle=g;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();
    ctx.fillStyle='#E6BE85';
    for(const px of [x,x+w/2,x+w]){ctx.beginPath();ctx.moveTo(px,y-2);ctx.lineTo(px+2,y);ctx.lineTo(px,y+2);ctx.lineTo(px-2,y);ctx.closePath();ctx.fill();}
    ctx.restore();
}
// Small editable edge ornaments: no text or hit area is baked into art.
function blossom(ctx,x,y,size) {
    const img=assets.get('uiIllustrationBlossom');
    if(img&&img.width&&img.height){ctx.drawImage(img,x-size*.62,y-size*.62,size*1.24,size*1.24);return;}
    ctx.save();ctx.translate(x,y);
    for(let i=0;i<5;i++){
        ctx.save();ctx.rotate(i*Math.PI*2/5);
        const g=ctx.createLinearGradient(0,-size*.52,0,0);g.addColorStop(0,'#FFF5E9');g.addColorStop(1,'#EAA3C2');
        ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,-size*.25,size*.18,size*.28,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#F9D7BA';ctx.lineWidth=.65;ctx.stroke();
        ctx.strokeStyle='rgba(255,249,232,.85)';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(0,-size*.05);ctx.quadraticCurveTo(-size*.06,-size*.22,0,-size*.42);ctx.stroke();ctx.restore();
    }
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.strokeStyle='#CFA052';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*size*.18,Math.sin(a)*size*.18);ctx.stroke();ctx.fillStyle='#FFF0B7';ctx.beginPath();ctx.arc(Math.cos(a)*size*.18,Math.sin(a)*size*.18,size*.035,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#D7A358';ctx.beginPath();ctx.arc(0,0,size*.07,0,Math.PI*2);ctx.fill();ctx.restore();
}
function flourish(ctx,x,y,sign,size) {
    ctx.save();ctx.translate(x,y);ctx.scale(sign*size/24,size/24);
    ctx.strokeStyle='#E6C68E';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(-18,0);ctx.bezierCurveTo(-6,-13,9,-13,9,-3);ctx.bezierCurveTo(9,5,0,5,2,-1);
    ctx.moveTo(-15,0);ctx.bezierCurveTo(-5,12,14,11,17,1);ctx.stroke();
    ctx.fillStyle='#FBECC5';ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(-19,-3);ctx.lineTo(-23,0);ctx.lineTo(-19,3);ctx.closePath();ctx.fill();ctx.restore();
}
function titlePlaque(ctx,x,y,w,h,label) {
    ctx.save();const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#4D679C');g.addColorStop(1,'#263D70');
    ctx.fillStyle=g;rounded(ctx,x,y,w,h,h/2);ctx.fill();ctx.strokeStyle='#E8C88D';ctx.lineWidth=1.6;ctx.stroke();
    const skin=assets.get('uiIllustrationFrame');
    if(skin&&skin.width&&skin.height){
        // Reuse the accepted blank star field. Labels stay native and editable.
        ctx.save();rounded(ctx,x+3,y+3,w-6,h-6,h/2-3);ctx.clip();
        ctx.drawImage(skin,skin.width*.28,skin.height*.06,skin.width*.44,skin.height*.075,x+3,y+3,w-6,h-6);ctx.restore();
    }
    rounded(ctx,x+3,y+3,w-6,h-6,h/2-3);ctx.strokeStyle='#FFF0CB';ctx.lineWidth=.7;ctx.stroke();
    flourish(ctx,x+13,y+h/2,-1,17);flourish(ctx,x+w-13,y+h/2,1,17);
    for(const side of [-1,1]){
        const px=side<0?x+3:x+w-3;
        blossom(ctx,px+side*2,y+h*.55,h*.70);
    }
    for(const sign of [-1,1]){
        flourish(ctx,x+w/2+sign*18,y+1,sign,12);
        ctx.fillStyle='#FFF1C9';ctx.beginPath();ctx.moveTo(x+w/2,y-5);ctx.lineTo(x+w/2+4,y);ctx.lineTo(x+w/2,y+5);ctx.lineTo(x+w/2-4,y);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='#FFF1CE';type.drawCentered(ctx,label,x+23,y,w-46,h,{size:h*.58,minSize:16,weight:'bold',family:SERIF});ctx.restore();
}
function decoratedButton(ctx,x,y,w,h,label,tone,size) {
    button(ctx,x,y,w,h,'',tone,size);
    const inset=w>=140?32:25;
    if(label){ctx.save();ctx.fillStyle=theme.buttonText[tone]||theme.buttonText.blue;type.drawCentered(ctx,label,x+inset,y,w-inset*2,h,{size:size||18,minSize:12,weight:'bold',family:SERIF});ctx.restore();}
    if(w>=140){pawSeal(ctx,x+20,y+h/2,16,tone);pawSeal(ctx,x+w-20,y+h/2,16,tone);}
    else {flourish(ctx,x+13,y+h/2,-1,12);flourish(ctx,x+w-13,y+h/2,1,12);}
}
function pawSeal(ctx,x,y,size,tone) {
    material.paw(ctx,x,y,size,tone);
}
module.exports = { drawItem, drawChest, drawFrame, paperFrame, resultFrame, scene, pedestal, button, card, rule, blossom, flourish, titlePlaque, decoratedButton, pawSeal };
