'use strict';

function pill(ctx,x,y,w,h) {
    const r=Math.min(h/2,w/2);
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// A narrow, alternating metal bevel around the editable colour surface.
function rim(ctx,x,y,w,h) {
    const gold=ctx.createLinearGradient(x,y,x+w*.18,y+h);
    [[0,'#FFF2BF'],[.14,'#C28C47'],[.29,'#FFF4CE'],[.54,'#D8AC67'],[.76,'#FFF0B4'],[1,'#B88243']].forEach(([p,c])=>gold.addColorStop(p,c));
    ctx.save();ctx.lineWidth=1.35;ctx.strokeStyle=gold;
    pill(ctx,x+1,y+1,w-2,h-2);ctx.stroke();
    const edge=ctx.createLinearGradient(x,y,x,y+h);
    edge.addColorStop(0,'#FFFFFF');edge.addColorStop(.46,'#FFF5E3');edge.addColorStop(1,'#FFF3C7');
    ctx.strokeStyle=edge;ctx.lineWidth=1;
    pill(ctx,x+2.6,y+2.6,w-5.2,h-5.2);ctx.stroke();
    ctx.restore();
}

// Reflections are shallow and feathered so the middle retains its pink/blue
// colour. The previous broad white cap flattened the button at phone size.
function shine(ctx,x,y,w,h,tone) {
    if(tone==='muted'||w<18||h<14)return;
    const r=Math.min(h/2,w/2),inset=Math.min(4,h*.12);
    ctx.save();pill(ctx,x+inset,y+inset,w-inset*2,h-inset*2);ctx.clip();
    const shade=ctx.createLinearGradient(x,y+h*.55,x,y+h);
    shade.addColorStop(0,'rgba(64,44,100,0)');shade.addColorStop(1,tone==='pink'?'rgba(150,50,104,.22)':'rgba(38,81,156,.22)');
    ctx.fillStyle=shade;ctx.fillRect(x,y+h*.55,w,h*.45);

    // Broad convex reflection: narrow at the ends and bowed over the centre.
    const light=ctx.createLinearGradient(x,y+inset,x,y+h*.34);
    light.addColorStop(0,'rgba(255,255,255,.86)');light.addColorStop(.36,'rgba(255,255,255,.38)');light.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(x+r*.54,y+h*.17);
    ctx.bezierCurveTo(x+r*.86,y+h*.055,x+w-r*.86,y+h*.055,x+w-r*.54,y+h*.17);
    ctx.quadraticCurveTo(x+w-inset,y+h*.24,x+w-r*.78,y+h*.28);
    ctx.bezierCurveTo(x+w*.72,y+h*.35,x+w*.28,y+h*.35,x+r*.78,y+h*.28);
    ctx.quadraticCurveTo(x+inset,y+h*.24,x+r*.54,y+h*.17);ctx.closePath();ctx.fill();

    // Light transmitted through the lower bevel, plus narrow specular arcs.
    const bounce=ctx.createLinearGradient(x,y+h*.78,x,y+h-inset);
    bounce.addColorStop(0,'rgba(255,251,255,0)');bounce.addColorStop(1,'rgba(255,251,255,.85)');
    ctx.strokeStyle=bounce;ctx.lineWidth=Math.max(1.6,h*.045);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x+r*.65,y+h*.76);ctx.quadraticCurveTo(x+r*.75,y+h*.92,x+r*1.25,y+h*.92);
    ctx.lineTo(x+w-r*1.25,y+h*.92);ctx.quadraticCurveTo(x+w-r*.75,y+h*.92,x+w-r*.65,y+h*.76);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.94)';ctx.lineWidth=Math.max(.8,h*.022);
    ctx.beginPath();ctx.moveTo(x+r*.42,y+h*.29);ctx.quadraticCurveTo(x+r*.55,y+h*.10,x+r*1.2,y+h*.10);
    ctx.lineTo(x+w-r*1.3,y+h*.10);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.48)';ctx.beginPath();ctx.moveTo(x+w-r*.4,y+h*.35);ctx.quadraticCurveTo(x+w-r*.22,y+h*.52,x+w-r*.42,y+h*.66);ctx.stroke();

    // Shoulder highlights avoid the editable label in the middle.
    for(const [px,py,rx,ry,angle] of [[x+r*.8,y+h*.17,r*.18,h*.028,-.35],[x+w-r*.7,y+h*.81,r*.12,h*.020,-.4]]) {
        ctx.fillStyle='rgba(255,255,255,.90)';ctx.beginPath();ctx.ellipse(px,py,rx,ry,angle,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();rim(ctx,x,y,w,h);
}

function paw(ctx,x,y,size,tone) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/20,size/20);
    const pink=tone==='pink';
    const pads=()=>{
        ctx.beginPath();ctx.moveTo(-7,6);ctx.bezierCurveTo(-9,1,-4,-2,0,-2);ctx.bezierCurveTo(4,-2,9,1,7,6);ctx.bezierCurveTo(5,10,2,7,0,7);ctx.bezierCurveTo(-2,7,-5,10,-7,6);ctx.closePath();ctx.fill();ctx.stroke();
        for(const [px,py,a] of [[-8,-2,-.5],[-3,-7,-.2],[3,-7,.2],[8,-2,.5]]){ctx.beginPath();ctx.ellipse(px,py,2.4,3.1,a,0,Math.PI*2);ctx.fill();ctx.stroke();}
    };
    const body=ctx.createLinearGradient(-3,-10,3,10);
    [[0,'#FFF7FA'],[.28,pink?'#FFE2EF':'#E1F3FF'],[.62,pink?'#EBA0C5':'#9EBFEA'],[1,pink?'#CC78A8':'#789ED5']].forEach(([p,c])=>body.addColorStop(p,c));
    ctx.fillStyle=body;ctx.strokeStyle=pink?'#CA86AA':'#85A7CF';ctx.lineWidth=.75;pads();
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=.7;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-6,3);ctx.quadraticCurveTo(-4,-1,0,-1);ctx.quadraticCurveTo(3,-1,5,2);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.92)';
    for(const [px,py] of [[-8.5,-3.4],[-3.5,-8.4],[2.5,-8.4],[7.5,-3.4]]){ctx.beginPath();ctx.ellipse(px,py,.75,1.2,-.35,0,Math.PI*2);ctx.fill();}
    ctx.restore();
}
module.exports={shine,paw};
