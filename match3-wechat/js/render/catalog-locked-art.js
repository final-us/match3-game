/** Static locked portrait, composed once from the accepted art and cat alpha. */
function soften(ctx, image, width, height, sigma, scratch) {
    // Separable Gaussian samples avoid both filter support and visible ghosting.
    const samples=[];
    let total=0;
    for(let i=-12;i<=12;i++) {
        const weight=Math.exp(-Math.pow(i/4,2)/2);
        samples.push({offset:i*sigma/4,weight});total+=weight;
    }
    const horizontal=scratch.getContext('2d');
    horizontal.clearRect(0,0,width,height);
    horizontal.save();horizontal.globalCompositeOperation='lighter';
    for(const sample of samples) {
        horizontal.globalAlpha=sample.weight/total;
        horizontal.drawImage(image,sample.offset,0,width,height);
    }
    horizontal.restore();
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const sample of samples) {
        ctx.globalAlpha=sample.weight/total;
        ctx.drawImage(scratch,0,sample.offset,width,height);
    }
    ctx.restore();
}

module.exports=function createLockedArt(image,mask,crop,createCanvas) {
    const width=crop[2],height=crop[3];
    const make=()=>{const canvas=createCanvas();canvas.width=width;canvas.height=height;return canvas;};
    const result=make(),blurred=make(),matte=make(),scratch=make();
    const ctx=result.getContext('2d');
    const sx=image.width/700,sy=image.height/776;
    ctx.drawImage(image,crop[0]*sx,crop[1]*sy,width*sx,height*sy,0,0,width,height);
    ctx.globalCompositeOperation='saturation';ctx.fillStyle='#B5B7C2';ctx.fillRect(0,0,width,height);
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(218,219,229,.26)';ctx.fillRect(0,0,width,height);
    soften(blurred.getContext('2d'),result,width,height,8,scratch);
    soften(matte.getContext('2d'),mask,width,height,5,scratch);
    const blur=blurred.getContext('2d');
    blur.globalCompositeOperation='destination-in';blur.drawImage(matte,0,0);
    ctx.drawImage(blurred,0,0);
    return result;
};
