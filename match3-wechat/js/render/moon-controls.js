// B support-page controls: native drawing only; callers own text, state and hitboxes.
const typography = require('./typography');

function path(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();ctx.moveTo(x + r, y);ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);ctx.closePath();
}

function panel(ctx, screen, x, y, w, h) {
    ctx.save();
    if (!screen.reduceEffects) {ctx.shadowColor='rgba(69,73,130,.22)';ctx.shadowBlur=12;ctx.shadowOffsetY=4;}
    const fill=ctx.createLinearGradient(x,y,x+w,y+h);
    fill.addColorStop(0,'rgba(255,252,255,.97)');fill.addColorStop(.5,'rgba(233,233,251,.96)');fill.addColorStop(1,'rgba(246,244,255,.97)');
    ctx.fillStyle=fill;path(ctx,x,y,w,h,24);ctx.fill();ctx.shadowColor='transparent';
    ctx.strokeStyle='#F9EBDA';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#C4C6E4';ctx.lineWidth=1;path(ctx,x+4,y+4,w-8,h-8,20);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.9)';path(ctx,x+6,y+6,w-12,h-12,18);ctx.stroke();
    for(const dx of [14,w-14]) for(const dy of [14,h-14]) {
        const p=ctx.createRadialGradient(x+dx-1,y+dy-1,0,x+dx,y+dy,3);
        p.addColorStop(0,'#FFFFFF');p.addColorStop(1,'#D5C1CE');
        ctx.fillStyle=p;ctx.beginPath();ctx.arc(x+dx,y+dy,2.8,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
}

function button(ctx, x, y, w, h, text, tone, fontSize) {
    const pink=tone==='pink', muted=tone==='muted';
    ctx.save();
    const g=ctx.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,'#FFFFFF');g.addColorStop(.18,pink?'#FAD9EE':'#EAF2FF');
    g.addColorStop(.65,muted?'#D1D6E5':pink?'#DB9FC7':'#ABC4EE');
    g.addColorStop(1,muted?'#E3E6EE':pink?'#F1C8E3':'#DCE9FB');
    ctx.fillStyle=g;path(ctx,x,y,w,h,h/2);ctx.fill();
    ctx.strokeStyle=muted?'#BEC5D8':pink?'#CCA3BB':'#9FAFD3';ctx.lineWidth=1.3;ctx.stroke();
    ctx.strokeStyle='#FFF9F0';path(ctx,x+2,y+2,w-4,h-4,h/2-2);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.moveTo(x+h/2,y+5);ctx.lineTo(x+w-h/2,y+5);ctx.stroke();
    if (text) {ctx.fillStyle=muted?'#626B88':'#303C70';typography.drawCentered(ctx,text,x+8,y,w-16,h,{size:fontSize||16,minSize:10,weight:'bold'});}
    ctx.restore();
}

function glyph(ctx, kind, x, y, size) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);
    ctx.fillStyle='#6578B1';ctx.strokeStyle='#6578B1';ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';
    if(kind==='music') {
        ctx.beginPath();ctx.moveTo(9,17);ctx.lineTo(9,5);ctx.lineTo(20,2);ctx.lineTo(20,15);ctx.stroke();
        ctx.beginPath();ctx.arc(6,18,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(17,16,3,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.moveTo(9,8);ctx.lineTo(20,5);ctx.stroke();
    } else if(kind==='sound') {
        ctx.beginPath();ctx.moveTo(2,9);ctx.lineTo(6,9);ctx.lineTo(12,4);ctx.lineTo(12,20);ctx.lineTo(6,15);ctx.lineTo(2,15);ctx.closePath();ctx.fill();
        for(const r of [5,9]) {ctx.beginPath();ctx.arc(11,12,r,-.8,.8);ctx.stroke();}
    } else if(kind==='privacy') {
        path(ctx,5,2,14,20,2);ctx.stroke();
        for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(9,8+i*4);ctx.lineTo(15,8+i*4);ctx.stroke();}
    } else if(kind==='home') {
        ctx.beginPath();ctx.moveTo(2,11);ctx.lineTo(12,2);ctx.lineTo(22,11);ctx.lineTo(19,11);ctx.lineTo(19,21);ctx.lineTo(14,21);ctx.lineTo(14,14);ctx.lineTo(10,14);ctx.lineTo(10,21);ctx.lineTo(5,21);ctx.lineTo(5,11);ctx.closePath();ctx.fill();
    } else if(kind==='video') {
        path(ctx,2,4,20,16,4);ctx.stroke();ctx.beginPath();ctx.moveTo(10,8);ctx.lineTo(16,12);ctx.lineTo(10,16);ctx.closePath();ctx.fill();
    } else {
        ctx.beginPath();ctx.moveTo(15,6);ctx.lineTo(9,12);ctx.lineTo(15,18);ctx.stroke();
    }
    ctx.restore();
}

function toggle(ctx,x,y,w,h,label,kind,on) {
    ctx.save();ctx.fillStyle='rgba(255,255,255,.67)';path(ctx,x,y,w,h,15);ctx.fill();
    ctx.strokeStyle='#FFFFFF';ctx.lineWidth=1;ctx.stroke();glyph(ctx,kind,x+12,y+(h-24)/2,24);
    ctx.fillStyle='#303C70';typography.drawFit(ctx,label,x+44,y+h/2,w-118,{size:16,minSize:12,weight:'bold'});
    const sx=x+w-62,sy=y+(h-28)/2;
    ctx.fillStyle=on?'#CD89B4':'#AFBBD8';path(ctx,sx,sy,50,28,14);ctx.fill();
    ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(sx+(on?36:14),sy+14,11,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=on?'#6D426B':'#465675';typography.drawFit(ctx,on?'开':'关',sx+(on?13:37),sy+14,16,{size:10,minSize:9,weight:'bold',align:'center'});
    ctx.restore();
}

function levelNode(ctx, x, y, size, state, reduceEffects) {
    ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/80,size/80);
    if(!reduceEffects) {ctx.shadowColor=state==='current'?'rgba(220,135,197,.6)':'rgba(68,86,145,.3)';ctx.shadowBlur=state==='current'?14:6;ctx.shadowOffsetY=3;}
    const g=ctx.createLinearGradient(10,4,64,76);
    g.addColorStop(0,'#FFFFFF');g.addColorStop(.25,state==='current'?'#FFE0F1':'#E8F3FF');
    g.addColorStop(.65,state==='current'?'#DA99C6':state==='locked'?'#B7BED6':'#A3BFEF');
    g.addColorStop(1,'#EEF0FF');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(12,25);ctx.quadraticCurveTo(4,-2,19,7);ctx.lineTo(31,15);
    ctx.quadraticCurveTo(40,12,49,15);ctx.lineTo(61,7);ctx.quadraticCurveTo(76,-2,68,25);
    ctx.bezierCurveTo(91,67,61,79,40,77);ctx.bezierCurveTo(19,79,-11,67,12,25);ctx.closePath();ctx.fill();
    ctx.shadowColor='transparent';ctx.strokeStyle='#FFFAEF';ctx.lineWidth=2.5;ctx.stroke();
    ctx.beginPath();ctx.arc(40,43,28,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.arc(40,43,25,Math.PI*1.12,Math.PI*1.83);ctx.strokeStyle='#FFFFFF';ctx.lineWidth=2;ctx.stroke();
    if(state==='locked') {
        ctx.translate(25,-8);
        ctx.strokeStyle='#6778A5';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.arc(40,27,5,Math.PI,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#F6F7FF';path(ctx,32,27,16,12,3);ctx.fill();ctx.stroke();
    } else if(state==='done') {
        ctx.translate(0,-43);
        ctx.fillStyle='#79ABAA';ctx.beginPath();ctx.arc(65,63,9,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#FFFFFF';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(61,63);ctx.lineTo(64,66);ctx.lineTo(69,60);ctx.stroke();
    }
    ctx.restore();
}

// Editable PvP icons share the reference kit's faceted ice and pink spiral silhouettes.
function battleIcon(ctx, kind, x, y, size) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/48,size/48);
    ctx.lineJoin='round';ctx.lineCap='round';
    if(kind==='freeze') {
        for(const [cx,cy,angle,scale] of [[13,30,-.4,.65],[34,29,.45,.72],[24,23,0,1]]) {
            ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.scale(scale,scale);
            const g=ctx.createLinearGradient(-8,-19,9,17);g.addColorStop(0,'#FFFFFF');g.addColorStop(.35,'#B8ECFF');g.addColorStop(1,'#7FA9DC');
            ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(10,-5);ctx.lineTo(8,13);ctx.lineTo(0,19);ctx.lineTo(-9,12);ctx.lineTo(-10,-5);ctx.closePath();ctx.fill();
            ctx.strokeStyle='#F1FAFF';ctx.lineWidth=1.5;ctx.stroke();
            ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(0,19);ctx.moveTo(-10,-5);ctx.lineTo(0,0);ctx.lineTo(10,-5);ctx.stroke();ctx.restore();
        }
    } else {
        const g=ctx.createRadialGradient(17,13,1,24,24,22);g.addColorStop(0,'#FFF7FD');g.addColorStop(.45,'#F7C8E8');g.addColorStop(1,'#CF8FB7');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(24,24,21,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#FFF5FB';ctx.lineWidth=2;ctx.stroke();
        ctx.beginPath();for(let i=0;i<=90;i++){const a=i/90*Math.PI*4,rad=1+i/90*15;const px=24+Math.cos(a)*rad,py=24+Math.sin(a)*rad;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);}
        ctx.strokeStyle='#BE75A7';ctx.lineWidth=4;ctx.stroke();ctx.translate(-1,-1);ctx.strokeStyle='#FFEAF8';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.restore();
}

module.exports={panel,button,glyph,toggle,levelNode,battleIcon};
